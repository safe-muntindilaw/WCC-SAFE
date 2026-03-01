// pdfReportGenerator.js
// Clean, minimal PDF layout. Simple colors, strict text containment.

import {
    computeForecast,
    getThresholdStatus,
    getForecastLabels,
} from "./ForecastEngine";

export async function generatePDFReport({
    chartTitle,
    chartSubtitle,
    reportType,
    data,
    dataStats,
    thresholds,
    selectedYears,
    chartCanvasBase64,
    chartAspectRatio,
    forecastSteps = 5,
}) {
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });
    const PW = 210; // page width
    const PH = 297; // page height
    const M = 16; // margin
    const CW = PW - M * 2; // content width

    // ─── PALETTE — minimal, 2-color system ───────────────────────────────────
    const NAVY = [30, 64, 120];
    const BLACK = [30, 30, 30];
    const MID = [110, 110, 110];
    const LIGHT = [240, 240, 240];
    const BORDER = [210, 210, 210];
    const WHITE = [255, 255, 255];

    // Threshold colors — kept muted
    const TH = {
        L0: [56, 142, 60],
        L1: [245, 176, 0],
        L2: [230, 100, 0],
        L3: [198, 40, 40],
    };

    // ─── STATE ───────────────────────────────────────────────────────────────
    let y = 0;

    // ─── CORE HELPERS ────────────────────────────────────────────────────────

    // Set font
    const F = (style = "normal", size = 9, color = BLACK) => {
        doc.setFont("helvetica", style);
        doc.setFontSize(size);
        doc.setTextColor(...color);
    };

    // Filled rectangle
    const R = (x, ry, w, h, color) => {
        doc.setFillColor(...color);
        doc.rect(x, ry, w, h, "F");
    };

    // Horizontal rule
    const HR = (ry, color = BORDER) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.25);
        doc.line(M, ry, PW - M, ry);
    };

    // ── Safe text: clips string to fit maxW, appends "…" if needed ──────────
    const safeText = (str, x, ry, maxW, opts = {}) => {
        let s = String(str ?? "");
        // Iteratively shorten until it fits
        while (doc.getTextWidth(s) > maxW && s.length > 1) {
            s = s.slice(0, -1);
        }
        if (String(str ?? "").length > s.length) s = s.slice(0, -1) + "\u2026";
        doc.text(s, x, ry, opts);
    };

    // ── Wrapped text: splits into lines that fit maxW, returns height used ──
    const wrapText = (str, x, ry, maxW, lineH = 4.8) => {
        const lines = doc.splitTextToSize(String(str ?? ""), maxW);
        doc.text(lines, x, ry);
        return lines.length * lineH;
    };

    // Page overflow guard — adds new page if needed
    const needY = (h) => {
        if (y + h > PH - 18) {
            doc.addPage();
            y = M + 4;
            // Minimal continuation header
            R(0, 0, PW, 10, NAVY);
            F("normal", 7, WHITE);
            safeText(chartTitle, M, 6.5, CW);
            y = 18;
        }
    };

    // Section divider — just a label + line, no colored box
    const section = (label) => {
        needY(12);
        F("bold", 7.5, MID);
        doc.text(label.toUpperCase(), M, y);
        HR(y + 2);
        y += 6;
    };

    // ─── PREPARE DATA ────────────────────────────────────────────────────────
    const values = data
        .flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v),
        )
        .filter((v) => v !== null && !isNaN(v));

    const forecast = computeForecast(values, forecastSteps, reportType);
    const forecastLabels = getForecastLabels(data, forecastSteps, reportType);
    const currentThreshold = getThresholdStatus(dataStats.recent, thresholds);
    const displayThresholds = thresholds.filter((t) => TH[t.name]);

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 1
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Header ────────────────────────────────────────────────────────────────
    R(0, 0, PW, 38, NAVY);

    F("bold", 16, WHITE);
    safeText("Water Level Report", M, 14, CW);

    F("normal", 8, [190, 210, 240]);
    safeText("Flood Monitoring System", M, 21, CW);

    // Report period — right column
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
    F("normal", 7.5, [190, 210, 240]);
    safeText(dateStr, PW - M, 14, 60, { align: "right" });

    // Chart title in header
    F("bold", 9.5, WHITE);
    safeText(chartTitle, M, 28, CW * 0.7);
    F("normal", 7.5, [190, 210, 240]);
    safeText(chartSubtitle, M, 34, CW * 0.7);

    y = 46;

    // ── Current status row ────────────────────────────────────────────────────
    if (currentThreshold) {
        const tc = TH[currentThreshold.name] || MID;
        // Thin left border + text — no big colored box
        R(M, y, 2, 10, tc);
        F("bold", 8.5, tc);
        safeText(
            `${currentThreshold.name}  —  ${dataStats.recent.toFixed(2)}m`,
            M + 5,
            y + 4,
            CW * 0.6,
        );
        F("normal", 7.5, MID);
        safeText(
            `Range: ${currentThreshold.converted_min_level}m – ${currentThreshold.converted_max_level}m`,
            M + 5,
            y + 8.5,
            CW * 0.6,
        );
        y += 15;
    }

    HR(y);
    y += 5;

    // ── Stats grid — 3 cols × 2 rows ─────────────────────────────────────────
    const nextForecast = forecast.points[0]?.value ?? dataStats.recent;
    const STATS = [
        { label: "Current", value: `${dataStats.recent.toFixed(2)} m` },
        { label: "Peak", value: `${dataStats.max.toFixed(2)} m` },
        { label: "Lowest", value: `${dataStats.min.toFixed(2)} m` },
        { label: "Average", value: `${dataStats.avg.toFixed(2)} m` },
        {
            label: "Trend",
            value: `${dataStats.trend >= 0 ? "+" : ""}${dataStats.trend.toFixed(2)} m`,
        },
        { label: "Forecast", value: `${nextForecast.toFixed(2)} m` },
    ];

    const COLS = 3;
    const cellW = CW / COLS;
    const cellH = 18;
    const GAP = 2;

    STATS.forEach((s, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const cx = M + col * cellW;
        const cy = y + row * (cellH + GAP);
        const iw = cellW - GAP;

        R(cx, cy, iw, cellH, LIGHT);
        // Label
        F("normal", 6.5, MID);
        safeText(s.label, cx + 4, cy + 6, iw - 8);
        // Value — truncated to cell width
        F("bold", 11, NAVY);
        safeText(s.value, cx + 4, cy + 13.5, iw - 8);
    });

    y += 2 * (cellH + GAP) + 8;

    // ── Chart image ───────────────────────────────────────────────────────────
    if (chartCanvasBase64) {
        section("Chart");
        // Derive height from the real captured aspect ratio so the chart is
        // never stretched on mobile. Fallback to 800/360 (desktop default).
        const ratio =
            chartAspectRatio && isFinite(chartAspectRatio) ? chartAspectRatio
            :   800 / 360;
        const imgH = Math.round(CW / ratio); // mm, preserves ratio
        const safeH = Math.min(imgH, 85); // cap at 85mm so it fits
        const safeW = Math.round(safeH * ratio); // shrink width if capped
        const imgX = M + (CW - safeW) / 2; // center if narrower than CW
        R(M, y, CW, safeH, LIGHT);
        try {
            doc.addImage(chartCanvasBase64, "PNG", imgX, y, safeW, safeH);
        } catch {
            F("normal", 8, MID);
            doc.text("Chart unavailable", M + 4, y + safeH / 2);
        }
        y += safeH + 8;
    }

    // ── Alert thresholds ──────────────────────────────────────────────────────
    if (displayThresholds.length > 0) {
        needY(30);
        section("Alert Levels");

        const thW = CW / displayThresholds.length;
        const thH = 18;

        displayThresholds.forEach((t, i) => {
            const tc = TH[t.name];
            const tx = M + i * thW;
            const tiw = thW - GAP;

            R(tx, y, tiw, thH, LIGHT);
            // Colored top strip — 3px tall
            R(tx, y, tiw, 3, tc);

            F("bold", 8.5, tc);
            safeText(t.name, tx + 4, y + 9, tiw - 8);

            F("normal", 7, MID);
            safeText(
                `${t.converted_min_level} – ${t.converted_max_level} m`,
                tx + 4,
                y + 15,
                tiw - 8,
            );
        });
        y += thH + 8;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 2 — FORECAST
    // ═══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    R(0, 0, PW, 18, NAVY);
    F("bold", 12, WHITE);
    safeText("Statistical Forecast", M, 12, CW * 0.65);
    F("normal", 7, [190, 210, 240]);
    safeText("Linear Regression + EWMA", PW - M, 12, 70, { align: "right" });
    y = 26;

    // ── Forecast stat cards ───────────────────────────────────────────────────
    if (forecast.stats) {
        const fs = forecast.stats;
        const FCARDS = [
            { label: "Direction", value: fs.trendDir },
            { label: "Rate", value: fs.trendRate },
            { label: "Std Dev", value: `\xB1${fs.stdDev.toFixed(3)} m` },
            { label: "R\xB2", value: `${(fs.r2 * 100).toFixed(0)}%` },
            { label: "Confidence", value: fs.confidence },
            { label: "Variability", value: fs.variability },
        ];

        const fCols = 3;
        const fCellW = CW / fCols;
        const fCellH = 16;

        FCARDS.forEach((fc, i) => {
            const col = i % fCols;
            const row = Math.floor(i / fCols);
            const cx = M + col * fCellW;
            const cy = y + row * (fCellH + GAP);
            const iw = fCellW - GAP;

            R(cx, cy, iw, fCellH, LIGHT);
            F("normal", 6.5, MID);
            safeText(fc.label, cx + 4, cy + 5.5, iw - 8);
            F("bold", 9, NAVY);
            safeText(fc.value, cx + 4, cy + 12, iw - 8);
        });

        y += 2 * (fCellH + GAP) + 10;
    }

    // ── Interpretation ────────────────────────────────────────────────────────
    if (forecast.interpretation) {
        section("Interpretation");
        const {
            trend,
            forecast: fcast,
            confidence: conf,
            range,
        } = forecast.interpretation;
        const narrative = [trend, fcast, conf, range].filter(Boolean).join(" ");
        F("normal", 8.5, BLACK);
        const nh = wrapText(narrative, M, y, CW, 5);
        y += nh + 8;
    }

    // ── Forecast table ────────────────────────────────────────────────────────
    if (forecast.points.length > 0) {
        needY(20);
        section("Projected Values");

        // Fixed column widths that sum exactly to CW
        const TCOLS = ["Period", "Forecast", "Lower", "Upper"];
        const TWIDTHS = [CW * 0.28, CW * 0.26, CW * 0.23, CW * 0.23];
        const rowH = 7.5;
        const hdrH = 8;

        // Header row
        R(M, y, CW, hdrH, NAVY);
        let cx = M;
        TCOLS.forEach((col, i) => {
            F("bold", 7.5, WHITE);
            // Pad 3mm, clip to column width minus 6mm for padding
            safeText(col, cx + 3, y + 5.5, TWIDTHS[i] - 6);
            cx += TWIDTHS[i];
        });
        y += hdrH;

        forecast.points.forEach((pt, i) => {
            needY(rowH + 1);
            if (i % 2 === 0) R(M, y, CW, rowH, LIGHT);

            cx = M;
            const ROW = [
                forecastLabels[i] ?? `+${pt.step}`,
                `${pt.value.toFixed(3)} m`,
                `${pt.lower.toFixed(3)} m`,
                `${pt.upper.toFixed(3)} m`,
            ];
            ROW.forEach((val, ci) => {
                F(ci === 1 ? "bold" : "normal", 8, ci === 1 ? NAVY : BLACK);
                safeText(val, cx + 3, y + 5, TWIDTHS[ci] - 6);
                cx += TWIDTHS[ci];
            });
            y += rowH;
        });
        y += 8;
    }

    // ── Bar chart ─────────────────────────────────────────────────────────────
    if (values.length > 2) {
        needY(46);
        section("Trend Overview");

        const hist = values.slice(-14);
        const fPts = forecast.points.map((p) => p.value);
        const allVals = [...hist, ...fPts];
        const minV = Math.min(...allVals) * 0.92;
        const maxV = Math.max(...allVals) * 1.05 || 1;
        const chH = 32;
        const totalBars = allVals.length;
        const barW = Math.max(2, Math.floor((CW - 2) / totalBars) - 1);

        // Background
        R(M, y, CW, chH, LIGHT);

        allVals.forEach((v, i) => {
            const isForecast = i >= hist.length;
            const barH = Math.max(1, ((v - minV) / (maxV - minV)) * (chH - 4));
            const bx = M + 1 + i * (barW + 1);
            const by = y + chH - 2 - barH;
            const color = isForecast ? [150, 130, 210] : NAVY;
            R(bx, by, barW, barH, color);
        });

        // Legend (below chart)
        const ly = y + chH + 4;
        R(M, ly, 8, 3, NAVY);
        F("normal", 7, MID);
        safeText("Historical", M + 10, ly + 2.5, 30);

        R(M + 46, ly, 8, 3, [150, 130, 210]);
        safeText("Forecast", M + 56, ly + 2.5, 30);

        y += chH + 12;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 3 — DATA TABLE  (skip for "today" — too many rows)
    // ═══════════════════════════════════════════════════════════════════════════
    if (data.length > 0 && reportType !== "today") {
        doc.addPage();
        R(0, 0, PW, 18, NAVY);
        F("bold", 12, WHITE);
        safeText("Data Table", M, 12, CW * 0.6);
        F("normal", 7, [190, 210, 240]);
        safeText(`${data.length} records`, PW - M, 12, 40, { align: "right" });
        y = 26;

        const DCOLS = Object.keys(data[0]);
        const dColW = CW / DCOLS.length;
        const dRowH = 7;
        const dHdrH = 8;

        // Header
        R(M, y, CW, dHdrH, NAVY);
        DCOLS.forEach((col, i) => {
            const cx2 = M + i * dColW;
            F("bold", 7.5, WHITE);
            safeText(
                col === "date" ? "Period" : col,
                cx2 + 3,
                y + 5.5,
                dColW - 6,
            );
        });
        y += dHdrH;

        data.forEach((row, ri) => {
            needY(dRowH + 1);
            if (ri % 2 === 0) R(M, y, CW, dRowH, LIGHT);
            DCOLS.forEach((col, i) => {
                const cx2 = M + i * dColW;
                const raw = row[col];
                const val =
                    raw != null ?
                        `${raw}${col !== "date" ? " m" : ""}`
                    :   "\u2014";
                F("normal", 8, BLACK);
                safeText(val, cx2 + 3, y + 5, dColW - 6);
            });
            y += dRowH;
        });
    }

    // ─── FOOTER — all pages ───────────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const fy = PH - 8;
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.25);
        doc.line(M, fy, PW - M, fy);
        F("normal", 6.5, [170, 170, 170]);
        safeText("Water Level Monitoring", M, fy + 4, 80);
        safeText(`Page ${p} of ${totalPages}`, PW - M, fy + 4, 30, {
            align: "right",
        });
    }

    return doc;
}
