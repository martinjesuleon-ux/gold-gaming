# Offline builder for classic asset packs
For use with the RC63 manifest-driven renderer. This tool operates on local raster files only, with no download or upload. Convert any authorized source graphics to PNG/WebP/JPEG atlases first. Supply a mapping JSON using the version:1, assets array format documented by RC63; each asset needs key, relative file, source and permission. The builder requires explicit catalog mappings; it does not guess ship IDs or claim a copyright license.
Validate before copying:
    node tools/build-classic-pack.js check /path/to/images mapping.json
Build a new staging directory:
    node tools/build-classic-pack.js build /path/to/images mapping.json /path/to/new-pack
Review audit.json for image dimensions, SHA-256 and byte counts. The builder checks file signatures and header dimensions, not full image decoding or artistic fidelity. It refuses traversal, external symlinks, unsupported formats, duplicate keys and uneven atlas cells. It never overwrites an existing output directory.
After review, deploy the authorized manifest and images to public/classic-pack/ in the repository, once the RC63 loader has been released. Keep the audit locally if provenance details are private. Never include game accounts, client executables or private source credentials.
