package app.spa.launcher.data

import android.content.Context
import android.content.SharedPreferences
import app.spa.launcher.ui.Accent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class LauncherSettings(
    val accent: Accent,
    val monoIcons: Boolean,
    val btOnStart: Boolean,
    val carplayOnStart: Boolean,
    val recent: String?,
    val slots: Map<String, String>,
)

class Prefs(ctx: Context) {
    private val sp: SharedPreferences = ctx.getSharedPreferences("spa", Context.MODE_PRIVATE)
    private val state = MutableStateFlow(read())
    val settings: StateFlow<LauncherSettings> = state.asStateFlow()

    private fun read() = LauncherSettings(
        accent = Accent.entries.firstOrNull { it.name == sp.getString("accent", null) } ?: Accent.ELEGANCE,
        monoIcons = sp.getBoolean("mono", true),
        btOnStart = sp.getBoolean("btboot", true),
        carplayOnStart = sp.getBoolean("cpboot2", false),
        recent = sp.getString("recent", null),
        slots = Slot.entries.mapNotNull { s -> sp.getString("slot_" + s.name, null)?.let { s.name to it } }.toMap(),
    )

    fun update(block: SharedPreferences.Editor.() -> Unit) {
        sp.edit().apply(block).apply()
        state.value = read()
    }
}
