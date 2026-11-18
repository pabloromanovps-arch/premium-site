package app.spa.launcher

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlin.math.abs

/**
 * Пульт для Bluetooth Music. У приложения нет ни плеера в системе, ни команд,
 * поэтому кнопки ⏮ ⏯ ⏭ лаунчера нажимают его собственные кнопки:
 * открываем Bluetooth Music без анимации → нажимаем нужную кнопку → сразу возвращаемся.
 */
object BtRemote {
    /** Включена ли служба (для экрана «Функции»). */
    val on = kotlinx.coroutines.flow.MutableStateFlow(false)
    @Volatile var service: BtAccessService? = null
        set(value) {
            field = value
            on.value = value != null
        }
    @Volatile var btPkg: String = "com.tw.bt"
    @Volatile var log: String = "ещё не нажимали"

    /** Открыть Bluetooth Music и вернуть лаунчер — задаёт MainActivity. */
    var openBt: (() -> Unit)? = null
    var backHome: (() -> Unit)? = null

    internal val handler = Handler(Looper.getMainLooper())
    @Volatile internal var pending: String? = null
    @Volatile internal var openedByUs = false
    private var timeout: Runnable? = null

    val enabled: Boolean get() = service != null

    /** kind: next, prev, toggle. false — служба не включена. */
    fun press(kind: String): Boolean {
        val s = service ?: return false
        // Окно Bluetooth Music уже на экране — нажимаем сразу, ничего не открывая.
        if (s.tryClick(kind)) {
            openedByUs = false
            return true
        }
        pending = kind
        openedByUs = true
        openBt?.invoke()
        timeout?.let { handler.removeCallbacks(it) }
        timeout = Runnable {
            if (pending != null) {
                pending = null
                log = "не нашли кнопку «$kind» за 2,5 с. $log"
                finish()
            }
        }.also { handler.postDelayed(it, 2500) }
        return true
    }

    internal fun done() {
        pending = null
        timeout?.let { handler.removeCallbacks(it) }
        handler.postDelayed({ finish() }, 120)
    }

    private fun finish() {
        if (openedByUs) backHome?.invoke()
        openedByUs = false
    }
}

class BtAccessService : AccessibilityService() {

    override fun onServiceConnected() {
        BtRemote.service = this
    }

    override fun onUnbind(intent: Intent?): Boolean {
        if (BtRemote.service === this) BtRemote.service = null
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        if (BtRemote.service === this) BtRemote.service = null
        super.onDestroy()
    }

    override fun onInterrupt() {}

    private var lastTry = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val kind = BtRemote.pending ?: return
        if (event?.packageName?.toString() != BtRemote.btPkg) return
        val now = SystemClock.uptimeMillis()
        if (now - lastTry < 60) return
        lastTry = now
        if (tryClick(kind)) BtRemote.done()
    }

    /** Найти и нажать кнопку в окне Bluetooth Music. */
    fun tryClick(kind: String): Boolean {
        val root = runCatching { rootInActiveWindow }.getOrNull() ?: return false
        if (root.packageName?.toString() != BtRemote.btPkg) return false
        val nodes = ArrayList<AccessibilityNodeInfo>()
        collect(root, nodes)
        if (nodes.isEmpty()) return false

        fun id(n: AccessibilityNodeInfo) = n.viewIdResourceName?.substringAfter(":id/").orEmpty()
        val i = RegexOption.IGNORE_CASE
        val byId = nodes.firstOrNull { n ->
            val v = id(n)
            when (kind) {
                "next" -> Regex("next", i).containsMatchIn(v)
                "prev" -> Regex("prev|pre_|_pre|last|back", i).containsMatchIn(v)
                else -> Regex("play|pause", i).containsMatchIn(v) && !Regex("list|mode", i).containsMatchIn(v)
            }
        }
        val target = byId ?: positional(nodes, kind)
        BtRemote.log = "«$kind» → " + (target?.let { id(it).ifBlank { "кнопка по положению" } } ?: "не найдено") +
            ". Кнопки окна: " + nodes.joinToString { id(it).ifBlank { it.className?.toString()?.substringAfterLast('.') ?: "?" } }
        return target?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
    }

    private fun collect(n: AccessibilityNodeInfo?, out: MutableList<AccessibilityNodeInfo>) {
        if (n == null) return
        if (n.isClickable && n.isVisibleToUser && n.isEnabled) out.add(n)
        for (k in 0 until n.childCount) collect(n.getChild(k), out)
    }

    /**
     * Если у кнопок нет понятных имён: берём ряд круглых кнопок одного размера на одной высоте
     * (в Bluetooth Music это «эквалайзер, назад, плей/пауза, вперёд») и выбираем по порядку.
     */
    private fun positional(nodes: List<AccessibilityNodeInfo>, kind: String): AccessibilityNodeInfo? {
        val withBounds = nodes.map { n -> n to Rect().also { n.getBoundsInScreen(it) } }
            .filter { (_, r) -> r.width() in 30..260 && r.height() in 30..260 }
        val row = withBounds.groupBy { (_, r) -> r.centerY() / 40 }.values
            .filter { it.size >= 3 }
            .maxByOrNull { g -> g.size * 10_000 + g.first().second.centerY() }
            ?.sortedBy { it.second.left }
            ?.filter { (_, r) -> abs(r.width() - r.height()) < r.width() / 2 }
            ?: return null
        if (row.size < 3) return null
        val last = row.size - 1
        return when (kind) {
            "next" -> row[last].first
            "toggle" -> row[last - 1].first
            else -> row[last - 2].first
        }
    }
}
