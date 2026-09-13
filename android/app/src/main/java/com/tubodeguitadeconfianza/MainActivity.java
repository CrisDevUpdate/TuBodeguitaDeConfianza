package com.tubodeguitadeconfianza;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.OnBackPressedDispatcher;

public class MainActivity extends ComponentActivity {
    private static final String APP_URL = "https://tubodeguitadeconfianza.vercel.app/";
    private static final String LOCAL_URL = "file:///android_asset/www/index.html";

    private WebView webView;
    private View splashView;
    private boolean localFallbackShown = false;
    private boolean pageReady = false;
    private final Handler splashHandler = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 18, 35));

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        splashView = createSplashView();
        root.addView(splashView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);

        configureWebView();

        webView.loadUrl(APP_URL);

        // Evita que una conexión lenta deje la pantalla de bienvenida indefinidamente.
        splashHandler.postDelayed(this::hideSplash, 6500);

        OnBackPressedDispatcher dispatcher = getOnBackPressedDispatcher();
        dispatcher.addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    dispatcher.onBackPressed();
                }
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                return !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pageReady = true;
                // Una pequeña pausa permite que el contenido termine de pintarse
                // antes de retirar la identidad visual de bienvenida.
                splashHandler.postDelayed(MainActivity.this::hideSplash, 500);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame() && !localFallbackShown) {
                    localFallbackShown = true;
                    pageReady = false;
                    view.loadUrl(LOCAL_URL);
                }
            }
        });
    }

    private View createSplashView() {
        FrameLayout splash = new FrameLayout(this);
        splash.setBackgroundColor(Color.rgb(8, 18, 35));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(28), dp(28), dp(28), dp(28));

        FrameLayout.LayoutParams contentParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        );
        splash.addView(content, contentParams);

        ImageView logo = new ImageView(this);
        logo.setImageResource(com.tubodeguitadeconfianza.R.drawable.ic_launcher_source);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        GradientDrawable glow = new GradientDrawable();
        glow.setShape(GradientDrawable.OVAL);
        glow.setColor(Color.argb(32, 37, 99, 235));
        logo.setBackground(glow);
        logo.setPadding(dp(10), dp(10), dp(10), dp(10));

        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(170), dp(170));
        logoParams.gravity = Gravity.CENTER_HORIZONTAL;
        content.addView(logo, logoParams);

        TextView title = new TextView(this);
        title.setText("Tu Bodeguita");
        title.setTextColor(Color.WHITE);
        title.setTextSize(30);
        title.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleParams.topMargin = dp(22);
        content.addView(title, titleParams);

        TextView subtitle = new TextView(this);
        subtitle.setText("de Confianza");
        subtitle.setTextColor(Color.rgb(34, 211, 238));
        subtitle.setTextSize(25);
        subtitle.setTypeface(Typeface.create("sans-serif", Typeface.BOLD_ITALIC));
        subtitle.setGravity(Gravity.CENTER);
        content.addView(subtitle, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView line = new TextView(this);
        line.setText("DULCES  •  CHOGUIS  •  SNACKS");
        line.setTextColor(Color.rgb(148, 163, 184));
        line.setTextSize(12);
        line.setLetterSpacing(0.14f);
        line.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lineParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lineParams.topMargin = dp(18);
        content.addView(line, lineParams);

        splash.setAlpha(1f);
        return splash;
    }

    private void hideSplash() {
        if (splashView == null || splashView.getVisibility() != View.VISIBLE) return;

        splashView.animate()
                .alpha(0f)
                .setDuration(280)
                .setInterpolator(new AccelerateDecelerateInterpolator())
                .withEndAction(() -> {
                    splashView.setVisibility(View.GONE);
                    splashView = null;
                })
                .start();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        splashHandler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
