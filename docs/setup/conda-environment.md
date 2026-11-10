# Python environment (Conda): `astera`

All backend code, tests and notebooks run in the Conda environment **`astera`**
(Python 3.11, all packages from conda-forge). Definition: [`environment.yml`](../../environment.yml).

> **Never use the MSYS2 Python** (`C:\msys64\mingw64\bin\python`) or the Conda
> `base` environment for this project. GDAL/Rasterio only work reliably from
> the `astera` env.

## Create the environment (once)

From the project root, in **Anaconda Prompt** or PowerShell:

```powershell
conda env create -f environment.yml
```

If `conda` is not on PATH, use the full path:

```powershell
& "$env:USERPROFILE\anaconda3\Scripts\conda.exe" env create -f environment.yml
```

> On some machines conda prints a warning about `anaconda-auth` / `typing_extensions`
> coming from the `base` environment. It does not affect the new env. Do not
> "fix" it by modifying `base`.

## Use the environment

```powershell
conda activate astera
python --version   # must print Python 3.11.x
```

Or, without activating a terminal, use `conda run`:

```powershell
conda run -n astera python --version
```

> **Don't call `...\envs\astera\python.exe` directly.** The PostGIS installer
> sets machine-wide `GDAL_DATA` / `PROJ_LIB` pointing at PostgreSQL's folders.
> Activation (and `conda run`) replaces them with the env's own paths. Calling
> the exe directly does not, which can cause PROJ/GDAL errors.

In VS Code: `Ctrl+Shift+P` → *Python: Select Interpreter* → `astera`.

## Verify the install

```powershell
conda run -n astera python docs/setup/verify_env.py
```

It checks imports, GDAL/PROJ/GEOS/HDF5 versions, the HDF5 and GeoTIFF drivers,
coordinate transforms, and that GDAL/PROJ data paths point inside the env.
It must end with `RESULT: PASS`.

## Register it as a Jupyter kernel

```powershell
python -m ipykernel install --user --name astera --display-name "Python (astera)"
```

## Update after `environment.yml` changes

```powershell
conda env update -f environment.yml --prune
```
