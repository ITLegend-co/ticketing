package com.mountaintorq.helpdesk;

import java.net.URI;
import java.security.MessageDigest;

final class UpdatePolicy {
  static boolean newer(String next,String installed){
    if(next==null||installed==null||!next.matches("[0-9]{1,6}\\.[0-9]{1,6}\\.[0-9]{1,6}")||!installed.matches("[0-9]{1,6}\\.[0-9]{1,6}\\.[0-9]{1,6}"))return false;
    String[] a=next.split("\\."),b=installed.split("\\.");
    for(int i=0;i<3;i++){int x=Integer.parseInt(a[i]),y=Integer.parseInt(b[i]);if(x!=y)return x>y;}return false;
  }
  static String filename(String version){
    if(!version.matches("[0-9]{1,6}\\.[0-9]{1,6}\\.[0-9]{1,6}"))throw new IllegalArgumentException();
    return "Mountain-Torq-Helpdesk-"+version+".apk";
  }
  static boolean allowed(String url){
    try{URI u=new URI(url);String host=u.getHost();return "https".equals(u.getScheme())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)&&("github.com".equals(host)||"release-assets.githubusercontent.com".equals(host)||"objects.githubusercontent.com".equals(host)||"itlegend-co.github.io".equals(host));}catch(Exception e){return false;}
  }
  static String checksum(String manifest,String name)throws Exception{
    for(String line:manifest.split("\\r?\\n")){String[] fields=line.trim().split("\\s+",2);if(fields.length==2&&fields[0].matches("[a-fA-F0-9]{64}")&&fields[1].replaceFirst("^\\*","").equals(name))return fields[0].toLowerCase(java.util.Locale.ROOT);}
    throw new Exception("Missing update checksum");
  }
  static String hash(java.io.File file)throws Exception{
    MessageDigest hash=MessageDigest.getInstance("SHA-256");try(java.io.InputStream in=new java.io.FileInputStream(file)){byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1)hash.update(bytes,0,n);}
    StringBuilder result=new StringBuilder();for(byte b:hash.digest())result.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return result.toString();
  }
}
