package com.thebitepath.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);


        // Get the WebView instance from Capacitor
        WebView webView = this.getBridge().getWebView();

        // Enable JavaScript in the WebView for React functionality
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);  // Enable JavaScript
        webSettings.setDomStorageEnabled(true);  // Enable localStorage for React (for landing page logic)

        // You can also enable other settings here as needed, such as cache control, etc.
    }
}

