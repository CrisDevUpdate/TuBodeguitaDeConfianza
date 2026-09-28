package com.tubodeguitadeconfianza;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
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
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;

public class MainActivity extends ComponentActivity {
    private static final String APP_URL = "https://tubodeguitadeconfianza.vercel.app/";
    private static final String LOCAL_URL = "file:///android_asset/www/index.html";

    private WebView webView;
    private View splashView;
    private boolean localFallbackShown = false;
    private boolean pageReady = false;
    private final Handler splashHandler = new Handler(Looper.getMainLooper());

    private ValueCallback<Uri[]> uploadMessage;
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private Uri cameraImageUri;

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

        // Configuración para manejar la respuesta del selector de archivos y cámara
        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (uploadMessage == null) return;
                    Uri[] results = null;
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        Intent data = result.getData();
                        if (data == null || data.getData() == null) {
                            // Si los datos son nulos, lo más probable es que sea de la cámara
                            if (cameraImageUri != null) {
                                results = new Uri[]{cameraImageUri};
                            }
                        } else {
                            String dataString = data.getDataString();
                            if (dataString != null) {
                                results = new Uri[]{Uri.parse(dataString)};
                            } else if (data.getClipData() != null) {
                                int count = data.getClipData().getItemCount();
                                results = new Uri[count];
                                for (int i = 0; i < count; i++) {
                                    results[i] = data.getClipData().getItemAt(i).getUri();
                                }
                            }
                        }
                    }
                    uploadMessage.onReceiveValue(results);
                    uploadMessage = null;
                    cameraImageUri = null;
                }
        );

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

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;

                Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
                    File photoFile = null;
                    try {
                        photoFile = File.createTempFile("JPEG_", ".jpg", getExternalCacheDir());
                    } catch (IOException ex) {
                        Log.e("MainActivity", "Error creating image file", ex);
                    }
                    if (photoFile != null) {
                        cameraImageUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", photoFile);
                        takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
                    }
                }

                Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentSelectionIntent.setType("*/*");
                if (fileChooserParams.getAcceptTypes() != null && fileChooserParams.getAcceptTypes().length > 0) {
                    contentSelectionIntent.setType(fileChooserParams.getAcceptTypes()[0]);
                }

                Intent[] intentArray;
                if (takePictureIntent.resolveActivity(getPackageManager()) != null && cameraImageUri != null) {
                    intentArray = new Intent[]{takePictureIntent};
                } else {
                    intentArray = new Intent[0];
                }

                Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
                chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
                chooserIntent.putExtra(Intent.EXTRA_TITLE, "Selecciona una acción");
                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray);

                try {
                    fileChooserLauncher.launch(chooserIntent);
                } catch (ActivityNotFoundException e) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                    return false;
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                String url = uri.toString();
                String scheme = uri.getScheme();

                if (scheme == null) return false;

                // 1. Manejo específico de WhatsApp (wa.me, api.whatsapp.com, whatsapp://, intent://)
                if (url.contains("wa.me") || url.contains("api.whatsapp.com") || "whatsapp".equalsIgnoreCase(scheme) || url.startsWith("intent:")) {
                    return handleWhatsAppOrExternalUrl(url, uri);
                }

                // 2. Manejo de esquemas comunes (tel:, mailto:, sms:)
                if ("tel".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme) || "sms".equalsIgnoreCase(scheme)) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        Log.e("MainActivity", "Error abriendo esquema " + scheme, e);
                        return true;
                    }
                }

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

    /**
     * Enruta enlaces de WhatsApp asegurando que abran la aplicación de WhatsApp Normal (com.whatsapp)
     * por defecto, o según la preferencia elegida por el usuario.
     */
    private boolean handleWhatsAppOrExternalUrl(String url, Uri uri) {
        try {
            // Si viene con formato intent:// explícito
            if (url.startsWith("intent:")) {
                try {
                    Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                    if (intent != null) {
                        startActivity(intent);
                        return true;
                    }
                } catch (Exception ignored) {}
            }

            // Extraer teléfono y mensaje si vienen en wa.me, api.whatsapp.com o whatsapp://
            String phone = null;
            String text = null;

            if (url.contains("wa.me/")) {
                phone = uri.getPath();
                if (phone != null && phone.startsWith("/")) {
                    phone = phone.substring(1);
                }
                text = uri.getQueryParameter("text");
            } else if (url.contains("api.whatsapp.com/send") || "whatsapp".equalsIgnoreCase(uri.getScheme())) {
                phone = uri.getQueryParameter("phone");
                text = uri.getQueryParameter("text");
            }

            // Verificar si el enlace trae parámetro para forzar la app específica
            String targetAppParam = uri.getQueryParameter("app");
            boolean forceBusiness = "business".equalsIgnoreCase(targetAppParam) || "com.whatsapp.w4b".equalsIgnoreCase(targetAppParam);
            boolean forceChooser = "preguntar".equalsIgnoreCase(targetAppParam) || "chooser".equalsIgnoreCase(targetAppParam);

            String preferredPackage = forceBusiness ? "com.whatsapp.w4b" : "com.whatsapp";

            // Construir Intent directo a WhatsApp
            Intent waIntent = new Intent(Intent.ACTION_VIEW);
            StringBuilder sb = new StringBuilder("whatsapp://send");
            boolean hasParam = false;
            if (phone != null && !phone.isEmpty()) {
                sb.append("?phone=").append(phone);
                hasParam = true;
            }
            if (text != null && !text.isEmpty()) {
                sb.append(hasParam ? "&text=" : "?text=").append(Uri.encode(text));
            }
            waIntent.setData(Uri.parse(sb.toString()));

            if (forceChooser) {
                Intent chooser = Intent.createChooser(waIntent, "Selecciona WhatsApp");
                startActivity(chooser);
                return true;
            }

            // Intentar primero con la aplicación seleccionada (por defecto WhatsApp Normal: com.whatsapp)
            try {
                getPackageManager().getPackageInfo(preferredPackage, 0);
                waIntent.setPackage(preferredPackage);
                startActivity(waIntent);
                return true;
            } catch (Exception notFound) {
                // Si la preferida no está instalada, intentar con la alternativa
                String altPackage = "com.whatsapp".equals(preferredPackage) ? "com.whatsapp.w4b" : "com.whatsapp";
                try {
                    getPackageManager().getPackageInfo(altPackage, 0);
                    waIntent.setPackage(altPackage);
                    startActivity(waIntent);
                    return true;
                } catch (Exception notFoundAlt) {
                    // Si ninguna específica está instalada, abrir selector o navegador
                    waIntent.setPackage(null);
                    try {
                        startActivity(Intent.createChooser(waIntent, "Enviar con"));
                    } catch (Exception browserFallback) {
                        Intent browser = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(browser);
                    }
                    return true;
                }
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Error procesando WhatsApp URL: " + url, e);
            try {
                Intent browser = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(browser);
            } catch (Exception ignored) {}
            return true;
        }
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
        logo.setImageResource(R.drawable.ic_launcher_source);
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
