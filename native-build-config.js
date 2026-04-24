/**
 * Crystal Fruit Odyssey - Native Build Configuration
 * Optimized for Store-Ready Production Builds (v1.0.0-FINAL)
 * 
 * This configuration file serves as the definitive specification for native 
 * distribution pipelines on Android (APK/AAB) and iOS (IPA).
 * 
 * Aesthetic Directive: Crystalline-Resin AAA Fidelity
 * Organization: NexApp
 */

export const NativeBuildConfig = {
    general: {
        app_name: "Crystal Fruit Odyssey",
        bundle_id: "com.nexapp.crystalfruitodyssey",
        marketing_version: "1.0.0",
        build_number: "1",
        organization_name: "NexApp",
        description: "A premium Match-3 crystalline odyssey featuring liquid crystal resin shaders and procedural audio.",
        category: "Games/Puzzle"
    },

    android: {
        min_sdk_version: 24, // Android 7.0 (Nougat)
        target_sdk_version: 34, // Android 14 (Upside Down Cake)
        compile_sdk_version: 34,
        
        // Signing & Security (Secure Production Keys)
        signing: {
            keystore_path: "certs/puzzle-odyssey.keystore",
            keystore_alias: "puzzle_odyssey_alias",
            keystore_password: "ArtJaber#66puzzuleApp",
            key_password: "jaber",
            
            /**
             * Generates the jarsigner command for manual signing integration.
             */
            generateSigningCommand: (unsignedApkPath, signedApkPath) => {
                return `jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA256 -keystore certs/puzzle-odyssey.keystore ${unsignedApkPath} puzzle_odyssey_alias`;
            },

            /**
             * Generates the zipalign command for optimization.
             */
            generateAlignCommand: (signedApkPath, finalApkPath) => {
                return `zipalign -v 4 ${signedApkPath} ${finalApkPath}`;
            }
        },

        // Visual Assets
        branding: {
            icon: "assets/sapphire-crystal-pineapple-marker.webp",
            splash_bg: "assets/splash-screen-bg-odyssey.webp",
            adaptive_icon: {
                foreground: "assets/sapphire-crystal-pineapple-marker.webp",
                background: "#0a0a20" // Deep sapphire theme
            }
        },

        build_format: "AAB", // Optimized for Play Store distribution
        architectures: ["arm64-v8a", "armeabi-v7a", "x86_64"]
    },

    ios: {
        marketing_version: "1.0",
        build_version: "1.0.0",
        deployment_target: "15.0",
        
        // Distribution & Provisioning
        provisioning: {
            provisioning_profile_name: "NexApp_Odyssey_Production_Profile",
            team_id: "NEXAPP_TEAM_ID",
            development_team_id: "NEXAPP_DEV_TEAM_ID",

            /**
             * Generates the xcodebuild archive command for automated CI pipelines.
             */
            generateArchiveCommand: (schemeName, archivePath) => {
                return `xcodebuild -workspace ios/CrystalFruitOdyssey.xcworkspace -scheme "${schemeName}" -archivePath "${archivePath}" archive CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="NEXAPP_TEAM_ID" PROVISIONING_PROFILE_SPECIFIER="NexApp_Odyssey_Production_Profile"`;
            },

            /**
             * Generates the production ExportOptions.plist content.
             */
            generateExportOptions: (method = 'app-store') => {
                return `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>${method}</string>
    <key>teamID</key>
    <string>NEXAPP_TEAM_ID</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.nexapp.crystalfruitodyssey</key>
        <string>NexApp_Odyssey_Production_Profile</string>
    </dict>
</dict>
</plist>`.trim();
            }
        },

        // Visual Assets
        branding: {
            icon: "assets/sapphire-crystal-pineapple-marker.webp",
            launch_screen: "assets/splash-screen-bg-odyssey.webp"
        },

        capabilities: [
            "In-App Purchase",
            "Game Center",
            "Push Notifications"
        ]
    },

    performance_targets: {
        target_fps: 60,
        render_engine: "Three.js (WebGL 2.0 / WebGPU Fallback)",
        audio_engine: "Tone.js (Procedural Scheduling)",
        asset_optimization: "WEBP_LOSSLESS"
    }
};

export default NativeBuildConfig;