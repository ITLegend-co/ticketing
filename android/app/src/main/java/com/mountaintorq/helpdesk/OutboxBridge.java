package com.mountaintorq.helpdesk;
import android.content.Context;
import org.json.*;
import java.util.UUID;

final class OutboxBridge {
  static JSONObject handle(Context c,JSONObject request)throws Exception{
    String action=request.getString("action");
    if("session".equals(action)){
      synchronized(BackgroundStore.LOCK){
        String uid=request.optString("uid");JSONObject old=BackgroundStore.read(c,"session");
        if(uid.isEmpty())BackgroundStore.write(c,"session",new JSONObject().put("uid","").put("sessionId",UUID.randomUUID().toString()));
        else{
          BackgroundStore.name(uid,"validate");String token=request.getString("refreshToken");if(token.length()<20||token.length()>10000)throw new Exception();
          String generation=old!=null&&uid.equals(old.optString("uid"))?old.getString("sessionId"):UUID.randomUUID().toString();
          BackgroundStore.write(c,"session",new JSONObject().put("uid",uid).put("refreshToken",token).put("sessionId",generation));
        }
      }
      return new JSONObject();
    }
    String uid=request.getString("uid"),id=request.getString("id"),name=BackgroundStore.name(uid,id);
    synchronized(BackgroundStore.LOCK){
      JSONObject session=BackgroundStore.read(c,"session");if(session==null||!uid.equals(session.optString("uid")))throw new Exception();
      JSONObject row=BackgroundStore.read(c,name);
      if("enqueue".equals(action)&&row==null){
        row=request.getJSONObject("entry");
        if(!uid.equals(row.getString("uid"))||!id.equals(row.getString("id"))||!uid.equals(row.getJSONObject("ticket").getString("requesterId")))throw new Exception();
        JSONArray photos=row.getJSONArray("photos");if(photos.length()>5)throw new Exception();
        for(int i=0;i<photos.length();i++){
          JSONObject photo=photos.getJSONObject(i);if(!photo.getString("id").matches("[a-f0-9-]{36}")||!photo.getString("type").matches("image/(jpeg|png|webp)"))throw new Exception();
          if(!photo.optBoolean("sent")){String b64=photo.getString("base64");if(b64.length()>6990510||android.util.Base64.decode(b64,android.util.Base64.DEFAULT).length>5*1024*1024)throw new Exception();}
        }
        row.put("message","Waiting for internet / Android background scheduler");BackgroundStore.write(c,name,row);
      }
      if(row==null)return new JSONObject().put("missing",true);
      if(!row.optBoolean("done"))UploadWorker.schedule(c,name);
      int pending=0;JSONArray photos=row.getJSONArray("photos");for(int i=0;i<photos.length();i++)if(!photos.getJSONObject(i).optBoolean("sent"))pending++;
      return new JSONObject().put("done",row.optBoolean("done")).put("saved",row.optBoolean("saved")).put("pending",pending).put("message",row.optString("message"));
    }
  }
}
