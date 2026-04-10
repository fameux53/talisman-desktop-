package com.talisman.app;

import android.os.Bundle;
import android.graphics.Color;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable WebView debugging for development
        WebView.setWebContentsDebuggingEnabled(true);

        // Ensure WebView has an opaque background and is hardware-accelerated
        WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.WHITE);
        webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

        // Clear the window background to remove any splash overlay
        getWindow().setBackgroundDrawableResource(android.R.color.white);
    }
}
