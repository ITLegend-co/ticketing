package com.mountaintorq.helpdesk;
import android.content.Context;
import android.app.*;
import android.content.Intent;
import android.os.Build;
import android.content.pm.PackageManager;
import androidx.work.*;
import org.json.*;
import java.net.*;
import java.io.*;
import java.util.concurrent.TimeUnit;

public class UploadWorker extends Worker {
  static final String DB="https://ticketing-a8461-default-rtdb.asia-southeast1.firebasedatabase.app";
  static final String KEY="AIzaSyCYw7zgHU2kxjf027_3sbR-76ba66yH9RY";
  static final String DRIVE="https://script.google.com/macros/s/AKfycbwWdD-gbK8HmtIAI_Sf9qM4zBKvOtO7jHPCtypiAyYVCGcrf5NNGu3XJ2WLdukkSc67ZQ/exec";
  public UploadWorker(Context c,WorkerParameters p){super(c,p);}
  static void schedule(Context c,String name)throws Exception{
    schedule(c,name,false);
  }
  static void schedule(Context c,String name,boolean retry)throws Exception{
    ExistingWorkPolicy policy=ExistingWorkPolicy.KEEP;
    if(retry){
      boolean running=false;
      for(WorkInfo info:WorkManager.getInstance(c).getWorkInfosForUniqueWork(name).get())if(info.getState()==WorkInfo.State.RUNNING)running=true;
      if(!running)policy=ExistingWorkPolicy.REPLACE;
    }
    OneTimeWorkRequest work=new OneTimeWorkRequest.Builder(UploadWorker.class).setInputData(new Data.Builder().putString("record",name).build()).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build();
    WorkManager.getInstance(c).enqueueUniqueWork(name,policy,work).getResult().get();
  }
  static String enc(String s)throws Exception{return URLEncoder.encode(s,"UTF-8");}
  private String uid,sessionId;
  private void active()throws Exception{
    JSONObject session=BackgroundStore.read(getApplicationContext(),"session");
    if(isStopped()||session==null||!uid.equals(session.optString("uid"))||!sessionId.equals(session.optString("sessionId")))throw new Problem("Sign in again to resume uploads.");
  }
  static class Problem extends IOException { Problem(String text){super(text);} }
  static final class Response {int code;String text;Response(int c,String t){code=c;text=t;}JSONObject json()throws Exception{return "null".equals(text.trim())?new JSONObject():new JSONObject(text);}}
  static Response request(String url,String method,String payload,String match)throws Exception{
    HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();
    try {connection.setConnectTimeout(20000);connection.setReadTimeout(45000);connection.setRequestMethod(method);connection.setInstanceFollowRedirects(true);
      if(match!=null)connection.setRequestProperty("if-match",match);
      if(payload!=null){connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
        if(url.startsWith("https://securetoken.googleapis.com/")){JSONObject body=new JSONObject(payload);payload="grant_type=refresh_token&refresh_token="+enc(body.getString("refresh_token"));connection.setRequestProperty("Content-Type","application/x-www-form-urlencoded");}try(OutputStream out=connection.getOutputStream()){out.write(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));}}
      int status=connection.getResponseCode();InputStream input=status>=400?connection.getErrorStream():connection.getInputStream();
      if(input==null)return new Response(status,"");
      try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>32*1024*1024)throw new Problem("Response too large");out.write(b,0,n);}return new Response(status,out.toString("UTF-8"));}
    } finally {connection.disconnect();}
  }
  private JSONObject json(String url,String method,JSONObject body)throws Exception{
    active();Response r=request(url,method,body==null?null:body.toString(),null);
    if(r.code<200||r.code>=300)throw new Problem(r.code==400||r.code==401||r.code==403?"Access could not be verified. Sign in again or contact IT.":"Connection interrupted. Waiting to retry.");return r.json();
  }
  private JSONObject drive(String id,String token,String action,JSONObject extra)throws Exception{
    extra.put("ticketId",id).put("idToken",token).put("action",action);JSONObject r=json(DRIVE,"POST",extra);
    if(!r.optBoolean("ok"))throw new Problem("Photo service could not finish. Your photos are kept for retry.");return r;
  }
  @Override public Result doWork(){
    Context c=getApplicationContext();String name=getInputData().getString("record");JSONObject row=null;
    try{
      if(name==null||!name.matches("q-[A-Za-z0-9_-]+"))return Result.failure();
      row=BackgroundStore.read(c,name);if(row==null||row.optBoolean("done"))return Result.success();
      uid=row.getString("uid");JSONObject session=BackgroundStore.read(c,"session");
      if(session==null||!uid.equals(session.optString("uid")))return Result.retry();
      sessionId=session.getString("sessionId");active();
      JSONObject refreshed=json("https://securetoken.googleapis.com/v1/token?key="+KEY,"POST",new JSONObject().put("grant_type","refresh_token").put("refresh_token",session.getString("refreshToken")));
      if(!uid.equals(refreshed.getString("user_id")))throw new Problem("Account mismatch. Sign in again.");
      String token=refreshed.getString("id_token");
      synchronized(BackgroundStore.LOCK){active();session.put("refreshToken",refreshed.getString("refresh_token"));BackgroundStore.write(c,"session",session);}
      String suffix=".json?auth="+enc(token),id=row.getString("id");
      JSONObject profile=json(DB+"/users/"+enc(uid)+suffix,"GET",null);
      if(!"Active".equals(profile.optString("status")))throw new Problem("Account inactive. Contact IT to resume.");
      if(!row.optBoolean("saved")){
        JSONObject records=json(DB+"/tickets.json?auth="+enc(token)+"&orderBy="+enc("\"requesterId\"")+"&equalTo="+enc(JSONObject.quote(uid)),"GET",null);
        JSONObject ticket=row.getJSONObject("ticket");
        if(records.has(id))verify(records.getJSONObject(id),ticket);
        else{
          ticket.put("requester",profile.getString("name")).put("department",profile.getString("department"));
          active();Response result=request(DB+"/tickets/"+id+suffix,"PUT",ticket.toString(),creationMatch(profile.optString("role")));
          if(result.code==412)verify(result.json(),ticket);
          else if(result.code==401||result.code==403)throw new Problem("Access denied. Ask IT to check your account permissions; your request is kept.");
          else if(result.code!=200)throw new Problem("Server could not confirm the ticket. Waiting to retry.");
        }
        row.put("saved",true);BackgroundStore.write(c,name,row);
      }
      JSONArray photos=row.getJSONArray("photos");
      for(int i=0;i<photos.length();i++){
        JSONObject photo=photos.getJSONObject(i);if(photo.optBoolean("sent"))continue;
        if(!drive(id,token,"list",new JSONObject()).optBoolean("resumableUploads"))throw new Problem("Ticket sent. IT must update the attachment service before photos can retry safely.");
        drive(id,token,"upload",new JSONObject().put("uploadId",photo.getString("id")).put("name",photo.getString("name")).put("mime",photo.getString("type")).put("base64",photo.getString("base64")));
        photo.put("sent",true).remove("base64");BackgroundStore.write(c,name,row);
      }
      // Retain a small receipt so a lost bridge response cannot enqueue another send.
      row.put("done",true).put("message","Sent successfully").remove("ticket");row.put("photos",new JSONArray());BackgroundStore.write(c,name,row);
      notifySent(id);return Result.success();
    }catch(Exception e){
      if(row!=null)try{row.put("message",e instanceof Problem?e.getMessage():"Upload interrupted. Your request is kept for retry.");BackgroundStore.write(c,name,row);}catch(Exception ignored){}
      return Result.retry();
    }
  }
  static String creationMatch(String role){return "IT Admin".equals(role)||"Management".equals(role)?"null_etag":null;}
  static void verify(JSONObject existing,JSONObject ticket)throws Exception{
    if(!existing.optString("requesterId").equals(ticket.getString("requesterId"))||existing.optLong("createdAt")!=ticket.getLong("createdAt"))throw new Problem("Request ID conflict. Contact IT.");
  }
  private void notifySent(String id){
    Context c=getApplicationContext();if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
    manager.createNotificationChannel(new NotificationChannel("uploads","Ticket uploads",NotificationManager.IMPORTANCE_DEFAULT));
    PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    try{manager.notify(id.hashCode(),new Notification.Builder(c,"uploads").setSmallIcon(com.mountaintorq.helpdesk.R.drawable.ic_helpdesk).setContentTitle("Support request sent").setContentText("Your ticket and queued photos have been uploaded.").setContentIntent(open).setAutoCancel(true).build());}catch(SecurityException ignored){}
  }
}
