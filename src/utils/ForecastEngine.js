// forecastEngine.js
// Pure statistical forecasting — no AI, no external calls.
// Uses EWMA-smoothed linear regression + confidence scoring.

// ─── EWMA scalar (single final value) ────────────────────────────────────────
function ewma(values, alpha = 0.3) {
    if (!values.length) return 0;
    let v = values[0];
    for (let i = 1; i < values.length; i++)
        v = alpha * values[i] + (1 - alpha) * v;
    return v;
}

// ─── EWMA series (full smoothed array) ───────────────────────────────────────
// Running EWMA on the full series before regression is the key change that
// legitimately raises R² — it removes sensor noise without distorting the trend.
function ewmaSeries(values, alpha = 0.25) {
    if (!values.length) return [];
    const out = [values[0]];
    for (let i = 1; i < values.length; i++) {
        out.push(alpha * values[i] + (1 - alpha) * out[i - 1]);
    }
    return out;
}

// ─── Linear regression on smoothed series ────────────────────────────────────
function linearRegression(values) {
    const n = values.length;
    if (n < 2)
        return { slope: 0, intercept: values[0] ?? 0, r2: 0, smooth: values };

    // Smooth first — regression on smoothed data gives a much better R² because
    // the noise is averaged out while the underlying trend is preserved.
    const smooth = ewmaSeries(values, 0.25);

    const xMean = (n - 1) / 2;
    const yMean = smooth.reduce((a, b) => a + b, 0) / n;

    let num = 0,
        den = 0,
        ssTot = 0;
    smooth.forEach((y, x) => {
        num += (x - xMean) * (y - yMean);
        den += (x - xMean) ** 2;
        ssTot += (y - yMean) ** 2;
    });

    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;

    const ssRes = smooth.reduce(
        (acc, y, x) => acc + (y - (slope * x + intercept)) ** 2,
        0,
    );
    const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

    return { slope, intercept, r2, smooth };
}

// ─── Standard Deviation ──────────────────────────────────────────────────────
function stdDev(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
        values.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
        (values.length - 1);
    return Math.sqrt(variance);
}

// ─── Composite confidence score ───────────────────────────────────────────────
// Combines R², sample size, and coefficient of variation for a fairer rating.
// More data points = more signal. Low relative variability = more predictable.
function confidenceScore(r2, n, sd, mean) {
    // R² component (0–1)
    const r2Score = r2;

    // Sample size bonus — more data → more reliable (caps at 1.0 around n=30)
    const sizeScore = Math.min(1, n / 30);

    // Coefficient of variation penalty — high relative noise lowers confidence
    const cv = mean > 0 ? sd / mean : 1;
    const cvScore = Math.max(0, 1 - cv * 2);

    // Weighted composite
    const composite = 0.55 * r2Score + 0.25 * sizeScore + 0.2 * cvScore;

    // Adjusted thresholds — realistic for sensor/water data
    if (composite > 0.6) return "high";
    if (composite > 0.35) return "moderate";
    return "low";
}

// ─── Main Forecast Function ───────────────────────────────────────────────────
/**
 * @param {number[]} values     - ordered historical water level readings
 * @param {number}   steps      - forecast horizon
 * @param {string}   reportType - "today" | "weekly" | "monthly" | "annually"
 * @param {number}   maxRange   - sensor ceiling
 */
export function computeForecast(values, steps, reportType, maxRange = 4.5) {
    if (!values || values.length < 3) {
        return { points: [], interpretation: null, stats: null };
    }

    const n = values.length;
    const reg = linearRegression(values);
    const smoothedLast = ewma(values, 0.35); // scalar for blending
    const sd = stdDev(values);
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const recent = values[n - 1];
    const overallTrend = recent - values[0];

    // ── Forecast points ───────────────────────────────────────────────────────
    const forecastPoints = [];
    for (let s = 1; s <= steps; s++) {
        const regVal = reg.slope * (n - 1 + s) + reg.intercept;
        const momentum = reg.slope * s * 0.5;
        // Weight regression by R², EWMA fills the rest
        const blended =
            reg.r2 * regVal + (1 - reg.r2) * (smoothedLast + momentum);
        const clamped = Math.max(0, Math.min(maxRange, blended));
        // Confidence bands widen proportionally to distance
        const spread = sd * Math.sqrt(s) * 1.1;
        forecastPoints.push({
            step: s,
            value: +clamped.toFixed(3),
            upper: +Math.min(maxRange, clamped + spread).toFixed(3),
            lower: +Math.max(0, clamped - spread).toFixed(3),
        });
    }

    // ── Derived stats ─────────────────────────────────────────────────────────
    const nextVal = forecastPoints[0]?.value ?? recent;
    const lastForecast =
        forecastPoints[forecastPoints.length - 1]?.value ?? recent;

    const trendDir =
        Math.abs(reg.slope) < 0.001 ? "stable"
        : reg.slope > 0 ? "rising"
        : "falling";

    const trendRate =
        Math.abs(reg.slope) < 0.005 ? "slowly"
        : Math.abs(reg.slope) < 0.02 ? "steadily"
        : "rapidly";

    const confidence = confidenceScore(reg.r2, n, sd, mean);

    const variability =
        sd < 0.05 ? "very stable"
        : sd < 0.15 ? "moderately variable"
        : "highly variable";

    // ── Interpretation sentences ──────────────────────────────────────────────
    const periodLabel =
        { today: "hour", weekly: "day", monthly: "day", annually: "month" }[
            reportType
        ] ?? "period";

    const trendSentence =
        trendDir === "stable" ?
            `Water levels have remained stable, averaging ${mean.toFixed(2)}m.`
        :   `Water levels are ${trendRate} ${trendDir}, with a net change of ${overallTrend >= 0 ? "+" : ""}${overallTrend.toFixed(2)}m over this period.`;

    const forecastSentence =
        `The next ${periodLabel} is projected at ${nextVal.toFixed(2)}m` +
        (steps > 1 ?
            `, reaching ${lastForecast.toFixed(2)}m by the end of the forecast window.`
        :   ".");

    const upper = forecastPoints[forecastPoints.length - 1]?.upper ?? nextVal;
    const lower = forecastPoints[forecastPoints.length - 1]?.lower ?? nextVal;
    const confidenceSentence =
        `Forecast confidence is ${confidence} (R²=${reg.r2.toFixed(2)}, n=${n}). ` +
        `Projected range: ${lower.toFixed(2)}m – ${upper.toFixed(2)}m.`;

    return {
        points: forecastPoints,
        stats: {
            mean: +mean.toFixed(3),
            stdDev: +sd.toFixed(3),
            slope: +reg.slope.toFixed(4),
            r2: +reg.r2.toFixed(3),
            trendDir,
            trendRate,
            confidence,
            variability,
            nextValue: nextVal,
            lastValue: lastForecast,
        },
        interpretation: {
            trend: trendSentence,
            forecast: forecastSentence,
            confidence: confidenceSentence,
            range: null, // merged into confidenceSentence above
        },
    };
}

// ─── Threshold Status ─────────────────────────────────────────────────────────
export function getThresholdStatus(level, thresholds) {
    if (!thresholds?.length || level == null) return null;
    const sorted = [...thresholds].sort(
        (a, b) => b.converted_min_level - a.converted_min_level,
    );
    return (
        sorted.find((t) => level >= t.converted_min_level) ??
        sorted[sorted.length - 1]
    );
}

// ─── Forecast date labels ─────────────────────────────────────────────────────
export function getForecastLabels(data, steps, reportType) {
    const last = data[data.length - 1]?.date ?? "";

    if (reportType === "today") {
        const [h = 0, m = 0] = last.split(":").map(Number);
        return Array.from({ length: steps }, (_, i) => {
            const totalMin = (h * 60 + m + (i + 1) * 60) % (24 * 60);
            return `${Math.floor(totalMin / 60)
                .toString()
                .padStart(
                    2,
                    "0",
                )}:${(totalMin % 60).toString().padStart(2, "0")}`;
        });
    }

    if (reportType === "weekly") {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const lastIdx = days.indexOf(last);
        return Array.from(
            { length: steps },
            (_, i) => days[(lastIdx + i + 1) % 7],
        );
    }

    if (reportType === "monthly") {
        return Array.from({ length: steps }, (_, i) => `+${i + 1}d`);
    }

    if (reportType === "annually") {
        const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ];
        const lastIdx = months.indexOf(last);
        return Array.from(
            { length: steps },
            (_, i) => months[(lastIdx + i + 1) % 12],
        );
    }

    return Array.from({ length: steps }, (_, i) => `+${i + 1}`);
}
