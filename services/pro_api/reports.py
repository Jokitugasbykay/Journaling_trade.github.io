"""Private PDF bytes generated from actual deterministic records."""
from html import escape
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, PolyLine, String


def generate_pdf(preview):
    output = BytesIO()
    styles = getSampleStyleSheet()
    story = [Paragraph("journalingtrade — Performance Report", styles["Title"]),
             Paragraph(escape(str(preview.get("period", "Selected period"))), styles["Normal"]), Spacer(1, 18)]

    def table(rows):
        formatted = [[Paragraph(escape(str(value if value is not None else "Unavailable")), styles["BodyText"]) for value in row] for row in rows]
        result = Table(formatted, repeatRows=1, hAlign="LEFT")
        result.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
                                   ("LINEBELOW", (0, 0), (-1, 0), .5, colors.black),
                                   ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
        return result

    if "analytics" in preview:
        analytics = preview["analytics"]
        story += [Paragraph("Performance Analytics", styles["Heading1"]),
                  table([["Metric", "Value"], *[[key.replace("_", " ").title(), value] for key, value in analytics["metrics"].items()]])]
        curve = analytics["equity"]
        if len(curve) > 1:
            values = [float(point["equity"]) for point in curve]
            low, high = min(values), max(values)
            drawing = Drawing(470, 150)
            points = [coordinate for index, value in enumerate(values) for coordinate in
                      (index / (len(values) - 1) * 450 + 10, 15 + (value - low) / (high - low or 1) * 110)]
            drawing.add(PolyLine(points, strokeColor=colors.black, strokeWidth=1.2))
            drawing.add(String(10, 135, "Equity curve — recorded account currency", fontSize=9))
            story += [Spacer(1, 14), drawing]
        for group, rows in analytics["groups"].items():
            story += [Paragraph("By " + group, styles["Heading2"]), table([["Group", "Trades", "Net PnL", "Win %"],
                    *[[row["label"], row["trade_count"], row["net_pnl"], row["win_rate"]] for row in rows]])]
        for warning in analytics["warnings"]:
            story.append(Paragraph(escape(warning), styles["Normal"]))
    if "heatmap" in preview:
        story += [Paragraph("Trading Activity", styles["Heading1"]),
                  table([["Date", "Trades", "Net PnL"], *[[day["date"], day["trade_count"], day["pnl"]]
                        for day in preview["heatmap"]["days"] if day["trade_count"]]])]
    if "risk" in preview:
        risk = preview["risk"]
        story += [Paragraph("Risk Compliance", styles["Heading1"]),
                  table([["Trade", "Rule", "Observed", "Limit"], *[[row["trade_id"], row["kind"], row["observed"], row["threshold"]]
                        for row in risk["violations"]]])]
        for warning in risk["warnings"]:
            story.append(Paragraph(escape(warning), styles["Normal"]))
    if "reviews" in preview:
        story.append(Paragraph("Saved Reviews", styles["Heading1"]))
        for review in preview["reviews"]:
            story.append(Paragraph(escape(str(review["period_start"]) + " — " + review["period"]), styles["Heading2"]))
            summary = review["summary"]
            for priority in summary.get("improvement_priorities", []):
                story.append(Paragraph(escape(priority["text"]), styles["Normal"]))
    story += [Spacer(1, 20), Paragraph("Statistics describe recorded trades. Missing contract metadata and missing values remain unavailable. No AI quota was consumed by this PDF.", styles["Normal"])]
    SimpleDocTemplate(output, pagesize=(595, 842), leftMargin=50, rightMargin=50, topMargin=45, bottomMargin=45).build(story)
    return output.getvalue()
