package app.spa.launcher.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Обложка по исполнителю и названию: Deezer, потом Apple Music (iTunes Search).
 * Оба сервиса бесплатные и без ключа. Сначала пробуем http: на магнитоле
 * со сбитыми часами https может не работать.
 */
object CoverApi {
    private fun get(url: String): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 7000
        readTimeout = 7000
        instanceFollowRedirects = true
    }

    private fun text(url: String): String = get(url).inputStream.bufferedReader().use { it.readText() }

    private fun image(url: String): Bitmap? {
        val variants = if (url.startsWith("https://")) listOf(url.replaceFirst("https://", "http://"), url) else listOf(url)
        for (u in variants) {
            runCatching { get(u).inputStream.use { BitmapFactory.decodeStream(it) } }.getOrNull()?.let { return scale(it) }
        }
        return null
    }

    fun scale(b: Bitmap): Bitmap {
        if (b.width <= 320) return b
        val h = (320f * b.height / b.width).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(b, 320, h, true)
    }

    private fun clean(s: String) = s
        .replace(Regex("\\s*[(\\[](feat|ft|prod|remaster|live)[^)\\]]*[)\\]]", RegexOption.IGNORE_CASE), "")
        .trim()

    suspend fun find(artist: String, title: String): Bitmap? = withContext(Dispatchers.IO) {
        val q = URLEncoder.encode(listOf(clean(artist), clean(title)).filter { it.isNotBlank() }.joinToString(" "), "UTF-8")
        val lookups: List<() -> String?> = listOf(
            { deezer("http://api.deezer.com/search?q=$q&limit=1") },
            { deezer("https://api.deezer.com/search?q=$q&limit=1") },
            { itunes("https://itunes.apple.com/search?term=$q&entity=song&limit=1") },
        )
        for (lookup in lookups) {
            val art = runCatching { lookup() }.getOrNull() ?: continue
            image(art)?.let { return@withContext it }
        }
        null
    }

    private fun deezer(url: String): String? {
        val data = JSONObject(text(url)).optJSONArray("data") ?: return null
        if (data.length() == 0) return null
        val album = data.getJSONObject(0).optJSONObject("album") ?: return null
        return album.optString("cover_big").ifBlank { album.optString("cover_medium") }.ifBlank { null }
    }

    private fun itunes(url: String): String? {
        val res = JSONObject(text(url)).optJSONArray("results") ?: return null
        if (res.length() == 0) return null
        return res.getJSONObject(0).optString("artworkUrl100").ifBlank { null }?.replace("100x100bb", "600x600bb")
    }
}
