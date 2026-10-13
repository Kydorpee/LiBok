fn main() {
    // No Windows, o manifesto (Common Controls v6) é embutido pelo próprio
    // linker em todos os alvos — inclusive os binários de `cargo test`, que o
    // `tauri_build` padrão não cobre e por isso morriam com
    // STATUS_ENTRYPOINT_NOT_FOUND (0xc0000139).
    let mut windows = tauri_build::WindowsAttributes::new();
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        windows = tauri_build::WindowsAttributes::new_without_app_manifest();
        embed_windows_manifest();
    }
    let attrs = tauri_build::Attributes::new().windows_attributes(windows);
    if let Err(e) = tauri_build::try_build(attrs) {
        panic!("tauri_build falhou: {e:#}");
    }
}

fn embed_windows_manifest() {
    let manifest =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("windows-app-manifest.xml");
    println!("cargo:rerun-if-changed={}", manifest.display());
    // Só o linker MSVC aceita estas flags.
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
}
