"""Training and Validation Pipeline for U-Net ResNet-34 SAR Segmentation."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from backend.processing.models.dataset import SARPatchDataset
from backend.processing.models.unet_resnet import BCEDiceLoss, MaskedBCEDiceLoss, UNetResNet34
from backend.processing.validation.metrics import calculate_segmentation_metrics

logger = logging.getLogger(__name__)


@dataclass
class TrainingResult:
    best_epoch: int
    best_val_iou: float
    best_val_dice: float
    train_losses: list[float]
    val_losses: list[float]
    val_ious: list[float]
    checkpoint_path: str
    total_training_time_sec: float
    masked_loss_used: bool = False


def _unpack_batch(batch: Any, target_device: str) -> Tuple[torch.Tensor, torch.Tensor, Optional[torch.Tensor]]:
    """Unpack (x, y) or (x, y, valid_mask) from DataLoader batch."""
    if len(batch) == 3:
        x_b, y_b, m_b = batch
        return x_b.to(target_device), y_b.to(target_device), m_b.to(target_device)
    x_b, y_b = batch
    return x_b.to(target_device), y_b.to(target_device), None


def train_unet_model(
    train_dataset: SARPatchDataset,
    val_dataset: SARPatchDataset,
    checkpoint_dir: Path,
    num_epochs: int = 15,
    batch_size: int = 8,
    learning_rate: float = 3e-4,
    device: Optional[str] = None,
    seed: int = 42,
    in_channels: int = 5,
    checkpoint_name: str = "unet_resnet34_best.pt",
) -> Tuple[UNetResNet34, TrainingResult]:
    """Trains the U-Net ResNet-34 model with validation checkpointing.

    When ``train_dataset`` / ``val_dataset`` carry ``valid_masks``, training loss and
    validation IoU/Dice are computed strictly on ``valid_mask > 0`` land pixels via
    ``MaskedBCEDiceLoss``, ensuring invalid, cloud, shadow, and water pixels contribute
    zero loss and zero gradient.
    """
    torch.manual_seed(seed)
    np.random.seed(seed)

    target_device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    masked_loss_used = getattr(train_dataset, "valid_masks", None) is not None
    logger.info(
        "Training U-Net on device: %s (masked_loss_used=%s)",
        target_device,
        masked_loss_used,
    )

    checkpoint_dir = Path(checkpoint_dir)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_file = checkpoint_dir / checkpoint_name

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0,
        drop_last=len(train_dataset) > batch_size,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
    )

    model = UNetResNet34(in_channels=in_channels, num_classes=1, pretrained=False)
    model.to(target_device)

    criterion = MaskedBCEDiceLoss(bce_weight=0.5)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_epochs, eta_min=1e-6)

    best_val_iou = 0.0
    best_val_dice = 0.0
    best_epoch = 0
    train_losses, val_losses, val_ious = [], [], []

    start_time = time.time()

    for epoch in range(1, num_epochs + 1):
        # Training Phase
        model.train()
        running_train_loss = 0.0
        n_train_batches = 0

        for batch in train_loader:
            x_batch, y_batch, m_batch = _unpack_batch(batch, target_device)

            optimizer.zero_grad()
            logits = model(x_batch)
            loss = criterion(logits, y_batch, valid=m_batch)
            if m_batch is None or float((m_batch > 0).sum().item()) > 0.0:
                loss.backward()
                optimizer.step()

            running_train_loss += float(loss.item())
            n_train_batches += 1

        scheduler.step()
        epoch_train_loss = running_train_loss / max(n_train_batches, 1)
        train_losses.append(round(epoch_train_loss, 4))

        # Validation Phase
        model.eval()
        running_val_loss = 0.0
        n_val_batches = 0
        all_preds = []
        all_targets = []
        all_valids = []

        with torch.no_grad():
            for batch in val_loader:
                x_val, y_val, m_val = _unpack_batch(batch, target_device)

                logits_val = model(x_val)
                v_loss = criterion(logits_val, y_val, valid=m_val)
                running_val_loss += float(v_loss.item())
                n_val_batches += 1

                probs_val = torch.sigmoid(logits_val).cpu().numpy()
                preds_val = (probs_val >= 0.5).astype(np.uint8)
                all_preds.append(preds_val)
                all_targets.append(y_val.cpu().numpy().astype(np.uint8))
                if m_val is not None:
                    all_valids.append((m_val.cpu().numpy() > 0).astype(np.uint8))

        epoch_val_loss = running_val_loss / max(n_val_batches, 1)
        val_losses.append(round(epoch_val_loss, 4))

        # Compute validation metrics strictly over valid pixels when valid_masks are supplied
        if all_preds:
            y_pred_cat = np.concatenate(all_preds, axis=0)
            y_true_cat = np.concatenate(all_targets, axis=0)
            y_valid_cat = np.concatenate(all_valids, axis=0) if all_valids else None
            metrics = calculate_segmentation_metrics(y_pred_cat, y_true_cat, valid_mask=y_valid_cat)
            epoch_iou = metrics.iou
            epoch_dice = metrics.dice
        else:
            epoch_iou, epoch_dice = 0.0, 0.0

        val_ious.append(round(epoch_iou, 4))

        # Checkpoint if best IoU
        if epoch_iou > best_val_iou or epoch == 1:
            best_val_iou = epoch_iou
            best_val_dice = epoch_dice
            best_epoch = epoch
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "val_iou": best_val_iou,
                    "val_dice": best_val_dice,
                    "in_channels": in_channels,
                    "masked_loss_used": masked_loss_used,
                    "norm_mean": train_dataset.norm_mean,
                    "norm_std": train_dataset.norm_std,
                },
                checkpoint_file,
            )

    total_time = round(time.time() - start_time, 2)

    result = TrainingResult(
        best_epoch=best_epoch,
        best_val_iou=best_val_iou,
        best_val_dice=best_val_dice,
        train_losses=train_losses,
        val_losses=val_losses,
        val_ious=val_ious,
        checkpoint_path=str(checkpoint_file),
        total_training_time_sec=total_time,
        masked_loss_used=masked_loss_used,
    )

    # Reload best weights
    if checkpoint_file.exists():
        ckpt = torch.load(checkpoint_file, map_location=target_device, weights_only=False)
        model.load_state_dict(ckpt["model_state_dict"])

    return model, result
