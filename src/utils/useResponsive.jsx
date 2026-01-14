import { useState, useEffect } from "react";
import { THEME } from "./theme";

// 1. CORE HOOK - Define this first as everything else uses it
export const useResponsive = () => {
    const [windowSize, setWindowSize] = useState({
        // Safe check for window existence
        width: typeof window !== "undefined" ? window.innerWidth : 1200,
        height: typeof window !== "undefined" ? window.innerHeight : 800,
    });

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return {
        isMobile: windowSize.width < THEME.BREAKPOINT_MOBILE,
        isTablet:
            windowSize.width >= THEME.BREAKPOINT_MOBILE &&
            windowSize.width < THEME.BREAKPOINT_DESKTOP,
        isDesktop: windowSize.width >= THEME.BREAKPOINT_DESKTOP,
        width: windowSize.width,
        height: windowSize.height,
    };
};

// 2. HELPER HOOKS - These depend on useResponsive()
export const useResponsivePadding = () => {
    const { isMobile } = useResponsive();
    return isMobile ? THEME.SPACING_SM : THEME.SPACING_LG;
};

export const useResponsiveStyles = () => {
    // Note: removed isDesktop to avoid the "defined but not used" warning
    const { isMobile, isTablet } = useResponsive();

    return {
        containerPadding: isMobile ? THEME.SPACING_SM : THEME.SPACING_LG,
        cardPadding: isMobile ? THEME.SPACING_SM : THEME.SPACING_LG,
        fontSize: {
            title: isMobile ? "18px" : "24px",
            subtitle: isMobile ? "14px" : "16px",
            body: isMobile ? "12px" : "14px",
        },
        buttonSize: isMobile ? "small" : "middle",
        tableSize: isMobile ? "small" : "middle",
        formLayout: isMobile ? "vertical" : "horizontal",
        modalWidth: isMobile ? "95%" : isTablet ? "70%" : "50%",
        maxModalWidth: isMobile ? "100%" : 600,
    };
};

export const useResponsiveTableScroll = () => {
    const { isMobile } = useResponsive();

    return {
        x: isMobile ? 800 : undefined,
        y: "calc(100vh - 400px)",
    };
};
