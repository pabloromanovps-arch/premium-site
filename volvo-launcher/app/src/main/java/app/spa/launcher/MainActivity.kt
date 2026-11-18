package app.spa.launcher

import android.Manifest
import android.app.ActivityOptions
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import app.spa.launcher.data.AppRepo
import app.spa.launcher.data.LaunchTarget
import app.spa.launcher.data.Slot
import app.spa.launcher.ui.ARect
import app.spa.launcher.ui.LauncherRoot
import app.spa.launcher.ui.SlotPicker
import app.spa.launcher.ui.UiActions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private lateinit var vm: LauncherVm
    private var homeSignal by mutableIntStateOf(0)
    private var picker by mutableStateOf<Slot?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()
        vm = ViewModelProvider(this)[LauncherVm::class.java]

        val actions = UiActions(
            launchSlot = ::launchSlot,
            launchApp = { app, r -> start(LaunchTarget.App(app.pkg, app.cls, app.label), r) },
            launchPkg = { pkg, r ->
                val i = packageManager.getLaunchIntentForPackage(pkg)
                if (i != null) startSafely(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), r) else launchSlot(Slot.MUSIC, r)
            },
            openSystem = { action, withPkg ->
                val i = Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (withPkg) i.data = Uri.parse("package:$packageName")
                startSafely(i, null)
            },
            openUrl = { url -> startSafely(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), null) },
            pick = { picker = it },
            appInfo = { app ->
                startSafely(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${app.pkg}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    null,
                )
            },
            requestLocation = ::requestLocation,
        )

        setContent {
            LauncherRoot(vm, homeSignal, actions) {
                picker?.let { slot -> SlotPicker(slot, vm) { picker = null } }
            }
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestLocation()
        }
        bootSoundWorkaround()
    }

    /**
     * На этой магнитоле звук в AUX появляется только после запуска AGAMA Car Launcher.
     * Сразу после включения открываем AGAMA на пару секунд и возвращаемся на главный экран.
     */
    private fun bootSoundWorkaround() {
        if (bootFlowDone) return
        bootFlowDone = true
        if (SystemClock.elapsedRealtime() > 5 * 60_000L) return
        if (!vm.prefs.settings.value.agamaOnStart) return
        lifecycleScope.launch {
            val apps = withContext(Dispatchers.IO) { AppRepo.load(this@MainActivity) }
            val agama = Slot.AGAMA.resolve(apps, vm.prefs.settings.value.slots) as? LaunchTarget.App ?: return@launch
            delay(1200)
            runCatching {
                startActivity(
                    Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                        .setComponent(ComponentName(agama.pkg, agama.cls))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
            delay(2500)
            runCatching {
                startActivity(
                    Intent(this@MainActivity, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                )
            }
        }
    }

    private fun requestLocation() {
        requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), REQ_LOCATION)
    }

    @Deprecated("Deprecated in Java")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_LOCATION) vm.location.start()
    }

    private fun launchSlot(slot: Slot, origin: ARect?) {
        val t = slot.resolve(vm.apps.value, vm.prefs.settings.value.slots)
        if (t == null) {
            picker = slot
            return
        }
        start(t, origin)
    }

    private fun start(t: LaunchTarget, origin: ARect?) {
        val intent = when (t) {
            is LaunchTarget.App -> Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                .setComponent(ComponentName(t.pkg, t.cls))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            is LaunchTarget.Url -> Intent(Intent.ACTION_VIEW, Uri.parse(t.url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            is LaunchTarget.Action -> Intent(t.action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startSafely(intent, origin)
    }

    /** Приложение «вырастает» из нажатой плитки, как в Sensus. */
    private fun startSafely(intent: Intent, origin: ARect?) {
        val opts = origin?.takeIf { it.width() > 0 && it.height() > 0 }?.let {
            ActivityOptions.makeScaleUpAnimation(window.decorView, it.left, it.top, it.width(), it.height()).toBundle()
        }
        try {
            startActivity(intent, opts)
        } catch (e: Exception) {
            Toast.makeText(this, "Не удалось открыть", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Повторное нажатие «Домой» возвращает на главный экран лаунчера.
        if (intent.hasCategory(Intent.CATEGORY_HOME) || intent.action == Intent.ACTION_MAIN) {
            homeSignal++
            picker = null
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()
        vm.onResume()
    }

    override fun onPause() {
        super.onPause()
        vm.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    companion object {
        private const val REQ_LOCATION = 1
        private var bootFlowDone = false
    }
}
