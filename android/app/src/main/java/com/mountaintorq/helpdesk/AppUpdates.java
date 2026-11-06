package com.mountaintorq.helpdesk;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.View;
import android.widget.*;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

final class AppUpdates {
  private final Activity activity;
  private final LinearLayout banner;
  private final TextView label;
  private final Button button;
  private final SharedPreferences prefs;
  private final File directory;
  private final ExecutorService executor=Executors.newSingleThreadExecutor();
  private boolean busy=false,closed=false,awaitingPermission=false,resumed=false;
  private long lastCheck=0;
  private String version="";
  AppUpdates(Activity a,LinearLayout root){
    activity=a;prefs=a.getSharedPreferences("app-updates",0);directory=new File(a.getFilesDir(),"app-updates");
    banner=new LinearLayout(a);banner.setPadding(20,8,20,8);banner.setBackgroundColor(0xffe8efff);banner.setGravity(android.view.Gravity.CENTER_VERTICAL);
    label=new TextView(a);label.setTextColor(0xff172b4d);banner.addView(label,new LinearLayout.LayoutParams(0,-2,1));
    button=new Button(a);banner.addView(button);banner.setVisibility(View.GONE);root.addView(banner,new LinearLayout.LayoutParams(-1,-2));
    button.setOnClickListener(v->{if(!busy){if(readyFile().isFile())install();else download();}});
  }
  private File readyFile(){return new File(directory,"update-"+version+".apk");}
  private void ui(String text,String action,boolean enabled){if(closed||activity.isDestroyed())return;label.setText(text);button.setText(action);button.setEnabled(enabled);banner.setVisibility(View.VISIBLE);}
  void resume(){
    resumed=true;
    if(closed)return;
    if(awaitingPermission){awaitingPermission=false;if(activity.getPackageManager().canRequestPackageInstalls())install();else ui("Allow updates from MT Helpdesk to continue.","Install update",true);return;}
    if(busy||System.currentTimeMillis()-lastCheck<6*60*60*1000L)return;
    busy=true;lastCheck=System.currentTimeMillis();
    executor.execute(()->{
      try{
        String latest=new JSONObject(text("https://itlegend-co.github.io/ticketing/mobile-release.json")).getString("version");
        activity.runOnUiThread(()->{busy=false;if(closed)return;if(UpdatePolicy.newer(latest,BuildConfig.VERSION_NAME)){version=latest;ui("Helpdesk "+version+" is available.",readyFile().isFile()?"Install update":"Update now",true);}else{banner.setVisibility(View.GONE);cleanOld();}});
      }catch(Exception e){activity.runOnUiThread(()->{busy=false;lastCheck=0;});}
    });
  }
  private static HttpURLConnection connect(String url)throws Exception{
    for(int i=0;i<6;i++){
      if(!UpdatePolicy.allowed(url))throw new IOException("Untrusted update URL");
      HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(20000);c.setReadTimeout(45000);c.setInstanceFollowRedirects(false);c.setRequestProperty("User-Agent","Mountain-Torq-Helpdesk");c.setRequestProperty("Cache-Control","no-cache");
      int status=c.getResponseCode();
      if(status>=300&&status<400){String location=c.getHeaderField("Location");c.disconnect();if(location==null)throw new IOException();url=new URL(new URL(url),location).toString();continue;}
      if(status!=200){c.disconnect();throw new IOException("Update server unavailable");}return c;
    }throw new IOException("Too many redirects");
  }
  private static String text(String url)throws Exception{
    HttpURLConnection c=connect(url);try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>16384)throw new IOException();out.write(b,0,n);}return out.toString("UTF-8");}finally{c.disconnect();}
  }
  private void download(){
    if(!UpdatePolicy.newer(version,BuildConfig.VERSION_NAME))return;
    busy=true;ui("Downloading update… You can keep using Helpdesk.","Downloading…",false);
    final String next=version;
    executor.execute(()->{
      File partial=null;
      try{
        if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException();
        String name=UpdatePolicy.filename(next),base="https://github.com/ITLegend-co/ticketing/releases/download/android-v"+next+"/";
        String hash=UpdatePolicy.checksum(text(base+"SHA256SUMS-Android.txt"),name);
        partial=File.createTempFile("download-",".part",directory);
        HttpURLConnection c=connect(base+name);
        try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(partial)){
          byte[] b=new byte[32768];int n;long total=0;while((n=in.read(b))!=-1){total+=n;if(total>128L*1024*1024)throw new IOException("Update too large");out.write(b,0,n);}
        }finally{c.disconnect();}
        verify(partial,hash);
        File ready=new File(directory,"update-"+next+".apk");if(!partial.renameTo(ready))throw new IOException("Could not save update");
        prefs.edit().putString("hash-"+next,hash).apply();
        activity.runOnUiThread(()->{busy=false;if(closed)return;ui("Update downloaded. Ready to install.","Install update",true);if(resumed)install();});
      }catch(Exception e){if(partial!=null)partial.delete();activity.runOnUiThread(()->{busy=false;ui("Update could not be downloaded or verified. Check your connection and retry.","Retry update",true);});}
    });
  }
  @SuppressWarnings("deprecation")
  private void verify(File file,String expected)throws Exception{
    if(!expected.matches("[a-f0-9]{64}")||!expected.equals(UpdatePolicy.hash(file)))throw new IOException("Checksum mismatch");
    PackageManager pm=activity.getPackageManager();
    PackageInfo candidate=pm.getPackageArchiveInfo(file.getAbsolutePath(),PackageManager.GET_SIGNATURES);
    PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),PackageManager.GET_SIGNATURES);
    if(candidate==null||!activity.getPackageName().equals(candidate.packageName)||candidate.signatures==null||installed.signatures==null||candidate.signatures.length==0||!Arrays.equals(candidate.signatures,installed.signatures))throw new IOException("Wrong application or signer");
    long newCode=Build.VERSION.SDK_INT>=28?candidate.getLongVersionCode():candidate.versionCode;
    long oldCode=Build.VERSION.SDK_INT>=28?installed.getLongVersionCode():installed.versionCode;
    if(newCode<=oldCode)throw new IOException("Update is not newer");
  }
  private void install(){
    if(closed||busy)return;
    if(!activity.getPackageManager().canRequestPackageInstalls()){
      try{awaitingPermission=true;activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));}catch(Exception e){awaitingPermission=false;ui("Open Android settings and allow updates from MT Helpdesk.","Install update",true);}return;
    }
    busy=true;ui("Verifying update…","Please wait",false);
    executor.execute(()->{
      try{
        File file=readyFile();verify(file,prefs.getString("hash-"+version,""));
        Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".updates",file);
        activity.runOnUiThread(()->{busy=false;if(closed)return;try{Intent intent=new Intent(Intent.ACTION_VIEW);intent.setDataAndType(uri,"application/vnd.android.package-archive");intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);activity.startActivity(intent);ui("Confirm Update in Android’s installation prompt.","Install update",true);}catch(Exception e){ui("Android could not open the installer. Tap to try again.","Install update",true);}});
      }catch(Exception e){readyFile().delete();activity.runOnUiThread(()->{busy=false;ui("Update verification failed. Please download it again.","Retry update",true);});}
    });
  }
  private void cleanOld(){File[] files=directory.listFiles();if(files!=null)for(File file:files)file.delete();prefs.edit().clear().apply();}
  void pause(){resumed=false;}
  void close(){closed=true;executor.shutdown();}
}
