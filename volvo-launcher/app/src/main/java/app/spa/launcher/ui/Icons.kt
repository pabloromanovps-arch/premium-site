package app.spa.launcher.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

private fun n(v: Float): String = if (v == v.toInt().toFloat()) v.toInt().toString() else v.toString()

private fun rect(x: Float, y: Float, w: Float, h: Float, r: Float): String =
    "M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}v${n(h - 2 * r)}" +
        "a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}h${n(-(w - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}" +
        "v${n(-(h - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}z"

private fun circle(cx: Float, cy: Float, r: Float): String =
    "M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z"

private fun icon(stroke: List<String>, fill: List<String> = emptyList(), width: Float = 1.6f): ImageVector {
    val b = ImageVector.Builder(defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
    stroke.forEach {
        b.addPath(
            pathData = addPathNodes(it),
            fill = null,
            stroke = SolidColor(Color.White),
            strokeLineWidth = width,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
        )
    }
    fill.forEach { b.addPath(pathData = addPathNodes(it), fill = SolidColor(Color.White)) }
    return b.build()
}

/** Тонкие линейные иконки в стиле Sensus. */
object Ic {
    val Apps = icon(listOf(rect(3f, 3f, 7f, 7f, 1f), rect(14f, 3f, 7f, 7f, 1f), rect(3f, 14f, 7f, 7f, 1f), rect(14f, 14f, 7f, 7f, 1f)))
    val Camera = icon(listOf(rect(2f, 7f, 15f, 11f, 2f), "M17 11l5-3v9l-5-3"))
    val CarPlay = icon(listOf(rect(2f, 4f, 20f, 14f, 2f), "M8 22h8M12 18v4"))
    val YouTube = icon(listOf(rect(2f, 5f, 20f, 14f, 4f), "M10 9l5 3-5 3z"))
    val Nav = icon(listOf("M12 2l7 19-7-4-7 4z"))
    val Music = icon(listOf("M9 18V5l12-2v13", circle(6f, 18f, 3f), circle(18f, 16f, 3f)))
    val Cloud = icon(listOf("M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.5 4.25 4.25 0 0 0 7 18z"))
    val Phone = icon(listOf("M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3l2 5-2.5 2.5a16 16 0 0 0 7 7L16 14l5 2z"))
    val Gear = icon(listOf(circle(12f, 12f, 3f), "M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"))
    val Sliders = icon(listOf("M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1", circle(16f, 6f, 2.2f), circle(10f, 12f, 2.2f), circle(18f, 18f, 2.2f)))
    val Bluetooth = icon(listOf("M7 7l10 10-5 5V2l5 5L7 17"))
    val Wifi = icon(listOf("M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"))
    val Sun = icon(listOf(circle(12f, 12f, 4f), "M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"))
    val Volume = icon(listOf("M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"))
    val Plus = icon(listOf("M5 12h14M12 5v14"))
    val Minus = icon(listOf("M5 12h14"))
    val Aux = icon(listOf("M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"))
    val Wave = icon(listOf("M2 12h1M6 8v8M10 4v16M14 7v10M18 10v4M22 12h-1"))
    val Palette = icon(listOf(circle(12f, 12f, 9f)), fill = listOf("M12 3a9 9 0 0 0 0 18z"))
    val Home = icon(listOf("M3 11l9-8 9 8M5 9.5V21h14V9.5"))
    val Shield = icon(listOf("M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z", "M9 12l2 2 4-4"))
    val Download = icon(listOf("M12 3v12M7 10l5 5 5-5M4 21h16"))
    val Close = icon(listOf("M6 6l12 12M18 6L6 18"))
    val Prev = icon(listOf("M19 20L9 12l10-8zM5 19V5"), width = 1.8f)
    val Next = icon(listOf("M5 4l10 8-10 8zM19 5v14"), width = 1.8f)
    val Play = icon(emptyList(), fill = listOf("M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"))
    val Pause = icon(emptyList(), fill = listOf(rect(6f, 4f, 4f, 16f, 1f), rect(14f, 4f, 4f, 16f, 1f)))
}
