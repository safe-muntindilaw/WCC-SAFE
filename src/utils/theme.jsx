// theme.js - Centralized theme constants
export const THEME = {
    // Primary Colors
    BLUE_ACCENT: "#1890ff",
    BLUE_PRIMARY: "#0056a0",
    BLUE_AUTHORITY: "#0A3D62",
    BLUE_HOVER: "#004480",

    // Accent Colors
    ACCENT_YELLOW: "#ffc72c",
    ACCENT_COLOR: "#f8b701",

    // Status Colors
    GREEN_SAFE: "#52C41A",
    YELLOW_NORMAL: "#fde321",
    ORANGE_ALERT: "#FFA500",
    RED_CRITICAL: "#e52c3b",
    RED_ERROR: "#ff0022",
    GREEN_SUCCESS: "#59ad2fff",

    // Background Colors
    BACKGROUND_LIGHT: "#f0f2f5",
    CARD_BG: "white",

    // Shadows and Effects
    CARD_SHADOW: "0 4px 12px rgba(0, 0, 0, 0.12)",
    CARD_SHADOW_HOVER: "0 8px 16px rgba(0, 86, 160, 0.2)",

    // Layout
    MAX_WIDTH: "1400px",
    BORDER_RADIUS: 10,
    BORDER_RADIUS_LARGE: 12,

    // Spacing
    SPACING_XS: 8,
    SPACING_SM: 12,
    SPACING_MD: 16,
    SPACING_LG: 24,
    SPACING_XL: 32,
    SPACING_XXL: 40,

    // Breakpoints
    BREAKPOINT_MOBILE: 768,
    BREAKPOINT_TABLET: 992,
    BREAKPOINT_DESKTOP: 1200,
};



export const cardStyleAdaptive = {
    borderRadius: THEME.BORDER_RADIUS,
    boxShadow: THEME.CARD_SHADOW,
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    background: THEME.CARD_BG,
    borderStyle: "solid",
    borderWidth: "4px 1px 1px 1px",
    borderColor: THEME.BLUE_PRIMARY,
};

export const primaryButtonStyle = {
    backgroundColor: THEME.BLUE_PRIMARY,
    borderColor: THEME.BLUE_PRIMARY,
    fontWeight: 600,
    height: 36,
};
