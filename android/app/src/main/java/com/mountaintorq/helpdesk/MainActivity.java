package com.mountaintorq.helpdesk;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.util.Collections;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
  private static final String HOME="https://itlegend-co.github.io/ticketing/";
  private WebView web;
  private ProgressBar progress;
  private LinearLayout offline;
  private ValueCallback<Uri[]> chooser;
  private byte[] pendingDownload;
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(Color.rgb(245,247,251));
    root.setOnApplyWindowInsetsListener((v,insets)->{
      v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
      return insets;
    });
    LinearLayout tools=new LinearLayout(this);
    Button back=new Button(this);back.setText("Back");back.setOnClickListener(v->onBackPressed());
    Button reload=new Button(this);reload.setText("Reload");reload.setOnClickListener(v->retry());
    Button browser=new Button(this);browser.setText("Browser");browser.setOnClickListener(v->external(NavigationPolicy.trusted(web.getUrl())?web.getUrl():HOME));
    tools.addView(back,new LinearLayout.LayoutParams(0,48*getResources().getDisplayMetrics().densityDpi/160,1));
    tools.addView(reload,new LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1));
    tools.addView(browser,new LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1));
    root.addView(tools);
    progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
    root.addView(progress,new LinearLayout.LayoutParams(-1,6));
    offline=new LinearLayout(this);offline.setOrientation(LinearLayout.VERTICAL);offline.setPadding(32,48,32,32);
    TextView message=new TextView(this);message.setText("Helpdesk could not load. Check your connection and tap Retry.");message.setTextSize(18);
    Button retry=new Button(this);retry.setText("Retry");retry.setOnClickListener(v->retry());
    offline.addView(message);offline.addView(retry);offline.setVisibility(View.GONE);root.addView(offline);
    web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
    setContentView(root);
    WebSettings settings=web.getSettings();
    settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setUserAgentString(settings.getUserAgentString()+" MountainTorqAndroid/"+BuildConfig.VERSION_NAME);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        String url=request.getUrl().toString();
        if(NavigationPolicy.trusted(url))return false;
        if(request.isForMainFrame()) external(url);
        return true;
      }
      @Override public void onReceivedError(WebView v,WebResourceRequest request,WebResourceError error){
        if(request.isForMainFrame()){offline.setVisibility(View.VISIBLE);web.setVisibility(View.GONE);}
      }
      @Override public void onPageFinished(WebView v,String url){CookieManager.getInstance().flush();}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public void onProgressChanged(WebView v,int value){progress.setProgress(value);progress.setVisibility(value==100?View.GONE:View.VISIBLE);}
      @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
        if(!NavigationPolicy.trusted(v.getUrl()))return false;
        if(chooser!=null)chooser.onReceiveValue(null);
        chooser=callback;
        Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.setType("image/*");pick.addCategory(Intent.CATEGORY_OPENABLE);
        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
        try {startActivityForResult(pick,10);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;}
        return true;
      }
    });
    if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
      WebViewCompat.addWebMessageListener(web,"MTFile",Collections.singleton("https://itlegend-co.github.io"),(view,messageEvent,origin,mainFrame,reply)->{
        if(!mainFrame || !NavigationPolicy.trusted(view.getUrl()))return;
        try {
          String data=messageEvent.getData();
          if(data==null || data.length()>32*1024*1024)throw new Exception();
          JSONObject object=new JSONObject(data);
          String mime=object.getString("mime");
          String extension;
          switch(mime){
            case "application/pdf":extension=".pdf";break;
            case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":extension=".xlsx";break;
            case "image/png":extension=".png";break;
            case "image/jpeg":extension=".jpg";break;
            case "image/webp":extension=".webp";break;
            default:throw new Exception();
          }
          if(pendingDownload!=null){toast("Finish saving the current file first.");return;}
          byte[] bytes=android.util.Base64.decode(object.getString("data"),android.util.Base64.DEFAULT);
          if(bytes.length>24*1024*1024)throw new Exception();
          pendingDownload=bytes;
          Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);save.setType(mime);save.addCategory(Intent.CATEGORY_OPENABLE);
          save.putExtra(Intent.EXTRA_TITLE,"Helpdesk-download"+extension);
          startActivityForResult(save,11);
        }catch(Exception e){pendingDownload=null;toast("Could not save this file. Use Browser to download it.");}
      });
    }
    web.setDownloadListener((url,ua,disposition,mime,length)->{
      if(url.startsWith("blob:https://itlegend-co.github.io/") && NavigationPolicy.trusted(web.getUrl()) && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
        String script="fetch("+JSONObject.quote(url)+").then(r=>r.blob()).then(b=>{if(b.size>25165824)throw Error();const f=new FileReader();f.onload=()=>MTFile.postMessage(JSON.stringify({mime:b.type,data:f.result.split(',')[1]}));f.readAsDataURL(b)}).catch(()=>alert('Use Browser to download this file.'));";
        web.evaluateJavascript(script,null);
      } else external(url);
    });
    if(state==null || web.restoreState(state)==null) web.loadUrl(HOME);
  }
  private void toast(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
  private void external(String url){
    if(url==null || !url.startsWith("https://")) {toast("This link cannot be opened in the app.");return;}
    try {startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){toast("No browser is available.");}
  }
  private void retry(){offline.setVisibility(View.GONE);web.setVisibility(View.VISIBLE);if(NavigationPolicy.trusted(web.getUrl()))web.reload();else web.loadUrl(HOME);}
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==10 && chooser!=null){
      Uri[] selected=null;
      if(result==RESULT_OK && data!=null){
        if(data.getClipData()!=null){int count=Math.min(data.getClipData().getItemCount(),5);selected=new Uri[count];for(int i=0;i<count;i++)selected[i]=data.getClipData().getItemAt(i).getUri();}
        else if(data.getData()!=null)selected=new Uri[]{data.getData()};
      }
      chooser.onReceiveValue(selected);chooser=null;
    }
    if(request==11){
      byte[] bytes=pendingDownload;pendingDownload=null;
      if(result==RESULT_OK && data!=null && data.getData()!=null && bytes!=null){
        Uri uri=data.getData();
        java.util.concurrent.ExecutorService executor=Executors.newSingleThreadExecutor();
        executor.execute(()->{try(java.io.OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new Exception();out.write(bytes);runOnUiThread(()->toast("File saved."));}catch(Exception e){runOnUiThread(()->toast("Could not save file."));}finally{executor.shutdown();}});
      }
    }
  }
  @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
  @Override protected void onSaveInstanceState(Bundle state){web.saveState(state);super.onSaveInstanceState(state);}
  @Override protected void onDestroy(){if(chooser!=null){chooser.onReceiveValue(null);chooser=null;}web.destroy();super.onDestroy();}
}
