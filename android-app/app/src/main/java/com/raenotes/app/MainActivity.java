package com.raenotes.app;

import android.app.Activity;
import android.annotation.SuppressLint;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.util.Locale;

/**
 * 单 Activity 外壳:把 assets/index.html 加载进 WebView。
 *
 * 关键点:Android WebView 不实现 Web Speech API(speechSynthesis),
 * 直接套壳会做出一个「点了没声音」的 App。这里把系统 TextToSpeech
 * 通过 JS 接口 window.AndroidTTS 暴露给网页,网页端已有对应的 shim。
 */
public class MainActivity extends Activity {

    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean warnedMissingVoice = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        // 忽略系统字体缩放,保证排版和设计一致(App 内自带 A-/A/A+ 调节)
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new TTSBridge(), "AndroidTTS");
        setContentView(web);

        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status != TextToSpeech.SUCCESS) return;
                int r = tts.setLanguage(new Locale("id", "ID"));
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // 部分 ROM 用旧代码 "in" 表示印尼语
                    r = tts.setLanguage(new Locale("in", "ID"));
                }
                ttsReady = (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED);
                if (!ttsReady && !warnedMissingVoice) {
                    warnedMissingVoice = true;
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            Toast.makeText(MainActivity.this,
                                "未安装印尼语语音包:设置 → 系统 → 语言 → 文字转语音 → 安装语音数据(Bahasa Indonesia)",
                                Toast.LENGTH_LONG).show();
                        }
                    });
                }
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onDone(String id) { fireDone(id); }
                    @Override public void onError(String id) { fireDone(id); }
                });
            }
        });

        web.loadUrl("file:///android_asset/index.html");
    }

    /** 通知网页「这一句读完了」,让高亮消失、跟读序列继续下一段。 */
    private void fireDone(final String id) {
        if (web == null) return;
        web.post(new Runnable() {
            @Override public void run() {
                String js = "javascript:window.__ttsDone && window.__ttsDone('" + id + "')";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    web.evaluateJavascript(js, null);
                } else {
                    web.loadUrl(js);
                }
            }
        });
    }

    /** 暴露给网页的对象:window.AndroidTTS */
    private class TTSBridge {
        @JavascriptInterface
        public void speak(String text, float rate, String id) {
            if (tts == null || text == null) return;
            tts.setSpeechRate(rate <= 0 ? 1.0f : rate);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
            } else {
                java.util.HashMap<String, String> p = new java.util.HashMap<String, String>();
                p.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, p);
            }
        }

        @JavascriptInterface
        public void stop() {
            if (tts != null) tts.stop();
        }

        @JavascriptInterface
        public boolean ready() {
            return ttsReady;
        }
    }

    /** 返回键:先翻页/退出抽屉由网页处理不了,这里直接退到上一页历史或退出。 */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        if (tts != null) tts.stop();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
        super.onDestroy();
    }
}
