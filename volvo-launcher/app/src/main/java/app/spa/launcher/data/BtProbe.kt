package app.spa.launcher.data

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.core.content.ContextCompat
import java.util.zip.ZipFile

/**
 * Разбирается с Bluetooth Music прямо на магнитоле, без его исходников:
 * 1) читает его APK и находит строки, похожие на названия системных рассылок (broadcast);
 * 2) слушает все эти рассылки и ищет в них название трека и исполнителя;
 * 3) всё найденное показывает в диагностике.
 */
class BtProbe(private val ctx: Context, private val onTrack: (AltTrack) -> Unit) {

    @Volatile var pkg: String? = null
        private set
    @Volatile var actions: List<String> = emptyList()
        private set
    @Volatile var commands: List<String> = emptyList()
        private set
    @Volatile var providers: List<String> = emptyList()
        private set
    @Volatile var heard: List<String> = emptyList()
        private set

    private var receiver: BroadcastReceiver? = null

    /** Вызывать не на главном потоке: читает APK. */
    fun scan(target: String): List<String> {
        val info = runCatching { ctx.packageManager.getApplicationInfo(target, 0) }.getOrNull() ?: return emptyList()
        val found = LinkedHashSet<String>()
        runCatching {
            ZipFile(info.sourceDir).use { zip ->
                zip.entries().asSequence()
                    .filter { it.name.startsWith("classes") && it.name.endsWith(".dex") }
                    .forEach { e -> zip.getInputStream(e).use { collect(it.readBytes(), found) } }
            }
        }
        providers = runCatching {
            ctx.packageManager.getPackageInfo(target, PackageManager.GET_PROVIDERS).providers
                ?.mapNotNull { it.authority } ?: emptyList()
        }.getOrDefault(emptyList())
        val all = found.toList()
        commands = all.filter { CMD.containsMatchIn(it) }.take(40)
        actions = all.take(250)
        pkg = target
        return actions
    }

    private fun collect(bytes: ByteArray, out: MutableSet<String>) {
        val sb = StringBuilder()
        fun flush() {
            if (sb.length in 10..120) {
                val s = sb.toString()
                val last = s.substringAfterLast('.')
                val isClass = last.firstOrNull()?.isUpperCase() == true && last.any { it.isLowerCase() }
                if (ACTION.matches(s) && SKIP.none { s.startsWith(it) } && HINT.containsMatchIn(s) && !isClass) out.add(s)
            }
            sb.setLength(0)
        }
        for (b in bytes) {
            val c = b.toInt() and 0xFF
            if (c in 0x21..0x7E) sb.append(c.toChar()) else flush()
        }
        flush()
    }

    /** Подписаться на найденные рассылки. Вызывать на главном потоке. */
    fun listen(list: List<String>) {
        receiver?.let { runCatching { ctx.unregisterReceiver(it) } }
        if (list.isEmpty()) return
        val r = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) = handle(i)
        }
        val filter = IntentFilter().apply { list.forEach { addAction(it) } }
        runCatching { ContextCompat.registerReceiver(ctx, r, filter, ContextCompat.RECEIVER_EXPORTED) }
        receiver = r
    }

    private fun flatten(b: Bundle?, prefix: String = "", out: MutableMap<String, Any?> = linkedMapOf()): Map<String, Any?> {
        if (b == null) return out
        for (k in b.keySet()) {
            @Suppress("DEPRECATION")
            val v = runCatching { b.get(k) }.getOrNull()
            if (v is Bundle && prefix.isEmpty()) flatten(v, "$k.", out) else out[prefix + k] = v
        }
        return out
    }

    private fun handle(i: Intent) {
        val extras = flatten(i.extras)
        val brief = extras.entries.joinToString(", ") { (k, v) -> "$k=" + v.toString().take(30) }
        heard = (listOf("${i.action?.substringAfterLast('.')} {${brief.take(160)}}") + heard).take(8)

        fun pick(re: Regex, not: Regex? = null) = extras.entries.firstOrNull { (k, v) ->
            re.containsMatchIn(k) && (not == null || !not.containsMatchIn(k)) && v is CharSequence && v.isNotBlank()
        }?.value?.toString()

        val title = pick(TITLE_KEY, Regex("artist|album|singer|device|bt_?name|phone", RegexOption.IGNORE_CASE)) ?: return
        val artist = pick(ARTIST_KEY).orEmpty()
        val dur = extras.entries.firstOrNull { (k, v) -> Regex("dur|total|length", RegexOption.IGNORE_CASE).containsMatchIn(k) && v is Number }
            ?.value?.let { (it as Number).toLong() } ?: 0L
        val pos = extras.entries.firstOrNull { (k, v) -> Regex("pos|progress|current|cur_?time", RegexOption.IGNORE_CASE).containsMatchIn(k) && v is Number }
            ?.value?.let { (it as Number).toLong() } ?: -1L
        val playing = extras.entries.firstOrNull { (k, v) -> Regex("play", RegexOption.IGNORE_CASE).containsMatchIn(k) && v is Boolean }?.value as? Boolean
        onTrack(
            AltTrack(
                source = "Bluetooth Music: ${i.action}",
                pkg = pkg,
                title = title,
                artist = artist,
                // Многие магнитолы присылают время в секундах.
                duration = if (dur in 1..36_000) dur * 1000 else dur,
                position = if (pos in 0..36_000) pos * 1000 else pos,
                playing = playing,
            )
        )
    }

    fun close() {
        receiver?.let { runCatching { ctx.unregisterReceiver(it) } }
        receiver = null
    }

    companion object {
        private val ACTION = Regex("[a-zA-Z][\\w]*(\\.[\\w\\-]+){2,}")
        private val SKIP = listOf("java.", "javax.", "kotlin.", "kotlinx.", "androidx.", "android.support.", "com.google.", "org.", "dalvik.", "sun.", "android.view.", "android.widget.")
        private val HINT = Regex("action|ACTION|[A-Z]{3,}_[A-Z_]+|id3|ID3|music|MUSIC|meta|META|track|TRACK|song|SONG|play|PLAY|avrcp|AVRCP|a2dp|A2DP|bt\\.|BT_", RegexOption.IGNORE_CASE)
        private val CMD = Regex("play|pause|next|prev|stop|resume", RegexOption.IGNORE_CASE)
        private val TITLE_KEY = Regex("title|song|track|name|id3", RegexOption.IGNORE_CASE)
        private val ARTIST_KEY = Regex("artist|singer|performer", RegexOption.IGNORE_CASE)
    }
}
