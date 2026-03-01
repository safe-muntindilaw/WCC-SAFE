// ReportGeneratorModal.jsx — clean, minimal UI, no AI

import React, { useState, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
    Modal,
    Button,
    Space,
    Typography,
    Alert,
    Flex,
    Progress,
    Tag,
    Divider,
} from "antd";
import {
    FilePdfOutlined,
    DownloadOutlined,
    LoadingOutlined,
    CheckCircleOutlined,
    RiseOutlined,
    FallOutlined,
    MinusOutlined,
} from "@ant-design/icons";
import { generatePDFReport } from "./pdfReportGenerator";
import { computeForecast, getThresholdStatus } from "./ForecastEngine";
import { OffscreenChart } from "./Offscreenchart";
import { THEME } from "@/utils/theme";

const { Text } = Typography;

const TH_COLORS = { L0: "green", L1: "gold", L2: "orange", L3: "red" };
const STEPS = ["Capture", "Forecast", "Build PDF", "Done"];

// ─── Offscreen chart capture ──────────────────────────────────────────────────
// Mounts a fresh React chart at 900px into a hidden div, waits for it to paint,
// then screenshots it. This guarantees a desktop-quality render regardless of
// the device screen width.
async function captureOffscreenChart({
    data,
    lineKeys,
    thresholds,
    reportType,
    yDomain,
    yTicks,
}) {
    const { default: html2canvas } = await import("html2canvas");

    const W = 900;
    const H = 380;

    const container = document.createElement("div");
    container.style.cssText = [
        "position:fixed",
        "left:-9999px",
        "top:0",
        `width:${W}px`,
        `height:${H}px`,
        "background:#fff",
        "overflow:hidden",
        "z-index:-1",
    ].join(";");
    document.body.appendChild(container);

    const root = createRoot(container);
    let dataUrl = null;

    try {
        root.render(
            <OffscreenChart
                data={data}
                lineKeys={lineKeys}
                thresholds={thresholds}
                reportType={reportType}
                yDomain={yDomain}
                yTicks={yTicks}
            />,
        );

        // Wait for React + Recharts to finish painting
        await new Promise((r) => setTimeout(r, 300));

        const canvas = await html2canvas(container, {
            backgroundColor: "#fff",
            scale: 2,
            useCORS: true,
            logging: false,
            width: W,
            height: H,
        });
        dataUrl = canvas.toDataURL("image/png");
    } catch (e) {
        console.warn("Chart capture failed:", e);
    } finally {
        // Unmount first, then remove node — avoids "Node cannot be found" error
        root.unmount();
        await new Promise((r) => setTimeout(r, 50));
        if (document.body.contains(container)) {
            document.body.removeChild(container);
        }
    }

    return dataUrl ? { dataUrl, aspectRatio: W / H } : null;
}

// ─── Modal component ──────────────────────────────────────────────────────────
export const ReportGeneratorModal = ({
    open,
    onClose,
    chartTitle,
    chartSubtitle,
    reportType,
    data,
    dataStats,
    thresholds,
    lineKeys,
    yDomain,
    yTicks,
    selectedYears,
}) => {
    const [step, setStep] = useState(-1);
    const [progress, setProgress] = useState(0);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [error, setError] = useState(null);
    const [generating, setGenerating] = useState(false);

    // Forecast preview — computed inline, no API
    const preview = useMemo(() => {
        if (!data?.length) return null;
        const vals = data
            .flatMap((d) =>
                Object.entries(d)
                    .filter(([k]) => k !== "date")
                    .map(([, v]) => v),
            )
            .filter((v) => v !== null && !isNaN(v));
        if (vals.length < 3) return null;
        return computeForecast(vals, 3, reportType);
    }, [data, reportType]);

    const activeTh = useMemo(
        () => getThresholdStatus(dataStats?.recent, thresholds),
        [dataStats, thresholds],
    );

    const reset = () => {
        setStep(-1);
        setProgress(0);
        setPdfDoc(null);
        setError(null);
        setGenerating(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleGenerate = useCallback(async () => {
        if (!data?.length || !dataStats) {
            setError("No data available. Please wait for data to load.");
            return;
        }
        setGenerating(true);
        setError(null);
        setPdfDoc(null);

        try {
            // Step 0 — render chart at desktop size and capture it
            setStep(0);
            setProgress(20);
            const chartCapture = await captureOffscreenChart({
                data,
                lineKeys,
                thresholds,
                reportType,
                yDomain,
                yTicks,
            });

            // Step 1 — forecast (already computed via useMemo)
            setStep(1);
            setProgress(55);
            await new Promise((r) => setTimeout(r, 100));

            // Step 2 — build PDF
            setStep(2);
            setProgress(75);
            const doc = await generatePDFReport({
                chartTitle,
                chartSubtitle,
                reportType,
                data,
                dataStats,
                thresholds,
                selectedYears,
                chartCanvasBase64: chartCapture?.dataUrl ?? null,
                chartAspectRatio: chartCapture?.aspectRatio ?? 900 / 380,
                forecastSteps: 5,
            });

            setPdfDoc(doc);
            setProgress(100);
            setStep(3);
        } catch (err) {
            console.error(err);
            setError("Failed to generate report. Please try again.");
            setStep(-1);
        } finally {
            setGenerating(false);
        }
    }, [
        data,
        dataStats,
        chartTitle,
        chartSubtitle,
        reportType,
        thresholds,
        selectedYears,
        lineKeys,
        yDomain,
        yTicks,
    ]);

    const handleDownload = useCallback(() => {
        if (!pdfDoc) return;
        const safe = chartTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const date = new Date().toISOString().slice(0, 10);
        pdfDoc.save(`water_report_${safe}_${date}.pdf`);
    }, [pdfDoc, chartTitle]);

    const isIdle = step === -1;
    const isDone = step === 3;

    const trendDir = preview?.stats?.trendDir;
    const TrendIcon =
        trendDir === "rising" ? <RiseOutlined style={{ color: "#e65100" }} />
        : trendDir === "falling" ? <FallOutlined style={{ color: "#2e7d32" }} />
        : <MinusOutlined style={{ color: "#666" }} />;

    return (
        <Modal
            open={open}
            onCancel={handleClose}
            centered
            title={
                <Space>
                    <FilePdfOutlined />
                    Export PDF Report
                </Space>
            }
            footer={null}
            width={440}
            destroyOnHidden>
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {/* Report summary */}
                <div
                    style={{
                        borderLeft: `3px solid ${THEME.BLUE_PRIMARY}`,
                        paddingLeft: 10,
                    }}>
                    <Text strong style={{ fontSize: 13, display: "block" }}>
                        {chartTitle}
                    </Text>
                    <Flex align="center" gap={8} style={{ marginTop: 3 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {chartSubtitle}
                        </Text>
                        {activeTh && (
                            <Tag
                                color={TH_COLORS[activeTh.name]}
                                style={{ margin: 0, fontSize: 11 }}>
                                {activeTh.name}
                            </Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {data?.length ?? 0} pts
                        </Text>
                    </Flex>
                </div>

                {/* Forecast preview */}
                {isIdle && preview?.stats && (
                    <>
                        <Divider style={{ margin: "4px 0" }} />
                        <div
                            style={{
                                background: "#fafafa",
                                borderRadius: 6,
                                padding: "10px 12px",
                                border: "1px solid #eee",
                            }}>
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: "#888",
                                    display: "block",
                                    marginBottom: 8,
                                }}>
                                FORECAST PREVIEW
                            </Text>
                            <Flex gap={0}>
                                <div style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            color: "#aaa",
                                            display: "block",
                                        }}>
                                        Next Period
                                    </Text>
                                    <Text
                                        strong
                                        style={{
                                            fontSize: 20,
                                            color: THEME.BLUE_PRIMARY,
                                        }}>
                                        {preview.points[0]?.value?.toFixed(2)}m
                                    </Text>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            color: "#aaa",
                                            display: "block",
                                        }}>
                                        Trend
                                    </Text>
                                    <Flex align="center" gap={4}>
                                        {TrendIcon}
                                        <Text strong style={{ fontSize: 13 }}>
                                            {trendDir}
                                        </Text>
                                    </Flex>
                                    <Text
                                        style={{ fontSize: 10, color: "#aaa" }}>
                                        {preview.stats.trendRate}
                                    </Text>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            color: "#aaa",
                                            display: "block",
                                        }}>
                                        Confidence
                                    </Text>
                                    <Tag
                                        color={
                                            (
                                                preview.stats.confidence ===
                                                "high"
                                            ) ?
                                                "green"
                                            : (
                                                preview.stats.confidence ===
                                                "moderate"
                                            ) ?
                                                "orange"
                                            :   "red"
                                        }>
                                        {preview.stats.confidence}
                                    </Tag>
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            color: "#aaa",
                                            display: "block",
                                        }}>
                                        R²={preview.stats.r2?.toFixed(2)}
                                    </Text>
                                </div>
                            </Flex>
                            {preview.interpretation?.trend && (
                                <Text
                                    style={{
                                        fontSize: 11,
                                        color: "#555",
                                        display: "block",
                                        marginTop: 8,
                                        lineHeight: 1.5,
                                    }}>
                                    {preview.interpretation.trend}
                                </Text>
                            )}
                        </div>
                        <Flex wrap="wrap" gap={4}>
                            {[
                                "Chart",
                                "Key stats",
                                "Thresholds",
                                "Forecast table",
                                "Trend chart",
                                "Data table",
                            ].map((item) => (
                                <Tag
                                    key={item}
                                    style={{ fontSize: 10, margin: 0 }}>
                                    {item}
                                </Tag>
                            ))}
                        </Flex>
                    </>
                )}

                {/* Progress */}
                {!isIdle && (
                    <Space
                        direction="vertical"
                        style={{ width: "100%" }}
                        size={6}>
                        <Flex gap={0} style={{ width: "100%" }}>
                            {STEPS.map((label, i) => {
                                const isLast = i === STEPS.length - 1;
                                const done =
                                    step > i ||
                                    (isLast && step === i && !generating);
                                const active = step === i && generating;
                                const pending = step < i;
                                return (
                                    <Flex
                                        key={label}
                                        align="center"
                                        gap={4}
                                        style={{
                                            flex: 1,
                                            opacity: pending ? 0.35 : 1,
                                        }}>
                                        {done ?
                                            <CheckCircleOutlined
                                                style={{
                                                    color: "#52c41a",
                                                    fontSize: 13,
                                                }}
                                            />
                                        : active ?
                                            <LoadingOutlined
                                                style={{ fontSize: 13 }}
                                            />
                                        :   <span
                                                style={{
                                                    width: 13,
                                                    height: 13,
                                                    border: "1px solid #ccc",
                                                    borderRadius: "50%",
                                                    display: "inline-block",
                                                }}
                                            />
                                        }
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color:
                                                    done ? "#52c41a"
                                                    : active ? "#000"
                                                    : "#aaa",
                                            }}>
                                            {label}
                                        </Text>
                                    </Flex>
                                );
                            })}
                        </Flex>
                        <Progress
                            percent={progress}
                            size="small"
                            showInfo={false}
                            strokeColor={
                                isDone ? "#52c41a" : THEME.BLUE_PRIMARY
                            }
                            status={
                                generating ? "active"
                                : isDone ?
                                    "success"
                                :   "normal"
                            }
                        />
                    </Space>
                )}

                {error && (
                    <Alert
                        type="error"
                        message={error}
                        showIcon
                        closable
                        onClose={() => setError(null)}
                    />
                )}

                <Flex justify="flex-end" gap={8} style={{ marginTop: 4 }}>
                    <Button onClick={handleClose} disabled={generating}>
                        {isDone ? "Close" : "Cancel"}
                    </Button>
                    {!isDone && (
                        <Button
                            type="primary"
                            icon={
                                generating ?
                                    <LoadingOutlined />
                                :   <FilePdfOutlined />
                            }
                            onClick={handleGenerate}
                            loading={generating}
                            disabled={generating || !data?.length}>
                            {generating ? "Generating…" : "Generate PDF"}
                        </Button>
                    )}
                    {isDone && (
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleDownload}
                            style={{
                                background: "#389e0d",
                                borderColor: "#389e0d",
                            }}>
                            Download PDF
                        </Button>
                    )}
                </Flex>
            </Space>
        </Modal>
    );
};

export default ReportGeneratorModal;
