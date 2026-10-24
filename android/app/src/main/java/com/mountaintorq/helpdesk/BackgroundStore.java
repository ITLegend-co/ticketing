package com.mountaintorq.helpdesk;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.*;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

// All records, including refresh tokens and image bytes, are encrypted with a
// non-exportable device key. AtomicFile keeps the last complete record on failure.
final class BackgroundStore {
  static final Object LOCK=new Object();
  private static javax.crypto.SecretKey key() throws Exception {
    KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
    if(!store.containsAlias("mt-outbox-v1")){
      KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
      generator.init(new KeyGenParameterSpec.Builder("mt-outbox-v1",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();
    }
    return (javax.crypto.SecretKey)store.getKey("mt-outbox-v1",null);
  }
  static File directory(Context c){File f=new File(c.getNoBackupFilesDir(),"outbox");if(!f.exists()&&!f.mkdirs())throw new IllegalStateException("Storage unavailable");return f;}
  static String name(String uid,String id){if(!uid.matches("[A-Za-z0-9_-]{1,128}")||!id.matches("[A-Za-z0-9_-]{1,120}"))throw new IllegalArgumentException("Invalid ID");return "q-"+uid.length()+"-"+uid+"_"+id;}
  static JSONObject read(Context c,String name)throws Exception{
    synchronized(LOCK){AtomicFile file=new AtomicFile(new File(directory(c),name));if(!file.getBaseFile().exists()&&!new File(file.getBaseFile()+".bak").exists())return null;
      byte[] bytes=file.readFully();if(bytes.length<13)throw new IOException("Invalid record");
      Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,bytes,0,12));
      return new JSONObject(new String(cipher.doFinal(bytes,12,bytes.length-12),java.nio.charset.StandardCharsets.UTF_8));}
  }
  static void write(Context c,String name,JSONObject value)throws Exception{
    synchronized(LOCK){Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());byte[] encrypted=cipher.doFinal(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
      AtomicFile file=new AtomicFile(new File(directory(c),name));FileOutputStream out=null;
      try{out=file.startWrite();out.write(cipher.getIV());out.write(encrypted);file.finishWrite(out);}catch(Exception e){if(out!=null)file.failWrite(out);throw e;}}
  }
}
