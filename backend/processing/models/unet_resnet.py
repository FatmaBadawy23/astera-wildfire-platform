"""U-Net Architecture with ResNet-34 Encoder for Multi-Channel SAR Wildfire Segmentation.

Adapts ImageNet pretrained ResNet-34 to multi-polarization SAR bitemporal inputs:
Input channels: [HH_pre, HV_pre, HH_post, HV_post, Delta_HV]
Output: Single-channel burned area probability logits.
"""

from __future__ import annotations

from typing import List, Optional, Tuple  # noqa: F401
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models


class ConvBlock(nn.Module):
    """Double convolution block with BatchNorm and ReLU."""

    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.conv(x)


class DecoderBlock(nn.Module):
    """Upsampling block with skip connection concatenation."""

    def __init__(self, in_channels: int, skip_channels: int, out_channels: int):
        super().__init__()
        self.upsample = nn.ConvTranspose2d(in_channels, in_channels // 2, kernel_size=2, stride=2)
        self.conv = ConvBlock(in_channels // 2 + skip_channels, out_channels)

    def forward(self, x: torch.Tensor, skip: torch.Tensor) -> torch.Tensor:
        x = self.upsample(x)
        # Handle potential padding differences
        if x.shape[2:] != skip.shape[2:]:
            x = F.interpolate(x, size=skip.shape[2:], mode="bilinear", align_corners=False)
        x = torch.cat([x, skip], dim=1)
        return self.conv(x)


class UNetResNet34(nn.Module):
    """U-Net with ResNet-34 encoder for paired SAR change detection."""

    def __init__(self, in_channels: int = 5, num_classes: int = 1, pretrained: bool = False):
        super().__init__()
        self.in_channels = in_channels
        self.num_classes = num_classes

        # Load ResNet-34 backbone
        base = models.resnet34(weights=models.ResNet34_Weights.DEFAULT if pretrained else None)

        # Adapt first convolution layer for N SAR channels
        orig_conv = base.conv1
        self.init_conv = nn.Conv2d(
            in_channels,
            orig_conv.out_channels,
            kernel_size=orig_conv.kernel_size,
            stride=orig_conv.stride,
            padding=orig_conv.padding,
            bias=False,
        )

        with torch.no_grad():
            if pretrained and in_channels >= 3:
                # Replicate RGB weights across additional radar channels
                rgb_w = orig_conv.weight.data
                self.init_conv.weight.data[:, :3] = rgb_w
                for c in range(3, in_channels):
                    self.init_conv.weight.data[:, c : c + 1] = rgb_w.mean(dim=1, keepdim=True)
            else:
                nn.init.kaiming_normal_(self.init_conv.weight, mode="fan_out", nonlinearity="relu")

        self.bn1 = base.bn1
        self.relu = base.relu
        self.maxpool = base.maxpool

        # Encoder stages
        self.encoder1 = base.layer1  # 64 channels
        self.encoder2 = base.layer2  # 128 channels
        self.encoder3 = base.layer3  # 256 channels
        self.encoder4 = base.layer4  # 512 channels

        # Center bridge
        self.center = ConvBlock(512, 512)

        # Decoder stages
        self.dec4 = DecoderBlock(in_channels=512, skip_channels=256, out_channels=256)
        self.dec3 = DecoderBlock(in_channels=256, skip_channels=128, out_channels=128)
        self.dec2 = DecoderBlock(in_channels=128, skip_channels=64, out_channels=64)
        self.dec1 = DecoderBlock(in_channels=64, skip_channels=64, out_channels=32)

        # Final upsampling to original input resolution
        self.final_upsample = nn.ConvTranspose2d(32, 16, kernel_size=2, stride=2)
        self.final_conv = nn.Sequential(
            nn.Conv2d(16, 16, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(16),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, num_classes, kernel_size=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        orig_size = x.shape[2:]

        # Stage 0
        x0 = self.relu(self.bn1(self.init_conv(x)))  # (B, 64, H/2, W/2)
        x_pool = self.maxpool(x0)  # (B, 64, H/4, W/4)

        # Encoder stages
        e1 = self.encoder1(x_pool)  # (B, 64, H/4, W/4)
        e2 = self.encoder2(e1)  # (B, 128, H/8, W/8)
        e3 = self.encoder3(e2)  # (B, 256, H/16, W/16)
        e4 = self.encoder4(e3)  # (B, 512, H/32, W/32)

        # Bridge
        c = self.center(e4)  # (B, 512, H/32, W/32)

        # Decoder
        d4 = self.dec4(c, e3)  # (B, 256, H/16, W/16)
        d3 = self.dec3(d4, e2)  # (B, 128, H/8, W/8)
        d2 = self.dec2(d3, e1)  # (B, 64, H/4, W/4)
        d1 = self.dec1(d2, x0)  # (B, 32, H/2, W/2)

        # Final prediction
        out = self.final_upsample(d1)  # (B, 16, H, W)
        if out.shape[2:] != orig_size:
            out = F.interpolate(out, size=orig_size, mode="bilinear", align_corners=False)
        logits = self.final_conv(out)
        return logits


class BCEDiceLoss(nn.Module):
    """Combined Binary Cross-Entropy and Dice Loss for burned area segmentation.

    Supports an optional ``valid`` mask (1 = valid land pixel, 0 = excluded/water/cloud/nodata).
    When ``valid`` is provided, invalid pixels contribute zero loss and zero gradient.
    """

    def __init__(self, bce_weight: float = 0.5, smooth: float = 1.0):
        super().__init__()
        self.bce_weight = float(bce_weight)
        self.smooth = float(smooth)
        self.bce = nn.BCEWithLogitsLoss()
        self._masked = MaskedBCEDiceLoss(bce_weight=bce_weight, smooth=smooth)

    def forward(
        self,
        logits: torch.Tensor,
        targets: torch.Tensor,
        valid: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        if valid is not None:
            return self._masked(logits, targets, valid=valid)

        bce_loss = self.bce(logits, targets)

        probs = torch.sigmoid(logits)
        probs_flat = probs.view(-1)
        targets_flat = targets.view(-1)

        intersection = (probs_flat * targets_flat).sum()
        dice_loss = 1.0 - (2.0 * intersection + self.smooth) / (
            probs_flat.sum() + targets_flat.sum() + self.smooth
        )

        return self.bce_weight * bce_loss + (1.0 - self.bce_weight) * dice_loss


class MaskedBCEDiceLoss(nn.Module):
    """BCE + Dice loss that ignores invalid pixels (``valid == 0``).

    For logits ``z``, binary targets ``y`` and validity mask ``m``::

        L_BCE  = sum(m * BCEWithLogits(z, y)) / max(sum(m), 1)
        L_Dice = 1 - (2 * sum(m * p * y) + s) / (sum(m * p) + sum(m * y) + s),   p = sigmoid(z)
        L      = w * L_BCE + (1 - w) * L_Dice

    Semantics:

    - ``m == 1``: valid land pixel and eligible for training.
    - ``m == 0``: invalid, water, cloud/shadow, SAR no-data, or otherwise excluded. Such a pixel is
      **not** treated as unburned. It contributes exactly zero loss and receives exactly zero gradient,
      and its logit and label values (even NaN/inf) cannot affect the result.
    - Aggregation is over the whole batch: BCE is the mean over all valid pixels in the batch, and Dice
      is computed over the pooled valid pixels of the batch. This matches the reduction of the legacy
      ``BCEDiceLoss``, so when ``m`` is all ones the two losses are numerically identical.
    - If the batch has no valid pixel at all, the loss is ``0.0`` with zero gradient (an
      empty-validity batch carries no supervision). It never produces NaN.
    - The BCE term uses ``binary_cross_entropy_with_logits`` (log-sum-exp form), so it stays finite for
      extreme logits.
    """

    def __init__(self, bce_weight: float = 0.5, smooth: float = 1.0):
        super().__init__()
        self.bce_weight = float(bce_weight)
        self.smooth = float(smooth)

    def forward(
        self,
        logits: torch.Tensor,
        targets: torch.Tensor,
        valid: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        if valid is None:
            valid_bool = torch.ones_like(logits, dtype=torch.bool)
        else:
            valid_bool = (valid.to(device=logits.device) > 0) & torch.isfinite(valid.to(device=logits.device))
            if valid_bool.shape != logits.shape:
                valid_bool = valid_bool.expand_as(logits)
        mask = valid_bool.to(dtype=logits.dtype)

        # Replace invalid entries *before* any arithmetic. torch.where routes zero gradient to the
        # unselected branch, so invalid logits receive exactly zero gradient, and NaN/inf at invalid
        # pixels can never propagate.
        zeros = torch.zeros_like(logits)
        safe_logits = torch.where(valid_bool, logits, zeros)
        safe_targets = torch.where(valid_bool, targets.to(dtype=logits.dtype), zeros)

        n_valid = mask.sum()
        if float(n_valid.detach().item()) <= 0.0:
            # Empty-validity batch: return 0.0 connected to graph with zero gradient everywhere
            return (safe_logits * 0.0).sum()

        bce_map = F.binary_cross_entropy_with_logits(safe_logits, safe_targets, reduction="none")
        bce_loss = (bce_map * mask).sum() / torch.clamp(n_valid, min=1.0)

        probs = torch.sigmoid(safe_logits) * mask
        tgt = safe_targets * mask
        intersection = (probs * tgt).sum()
        denom = torch.clamp(probs.sum() + tgt.sum() + self.smooth, min=1e-7)
        dice_loss = 1.0 - (2.0 * intersection + self.smooth) / denom

        return self.bce_weight * bce_loss + (1.0 - self.bce_weight) * dice_loss
