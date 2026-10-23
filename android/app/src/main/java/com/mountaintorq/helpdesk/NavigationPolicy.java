package com.mountaintorq.helpdesk;
import java.net.URI;
public final class NavigationPolicy {
  public static boolean trusted(String value) {
    try {
      URI u=new URI(value);
      return "https".equals(u.getScheme()) && "itlegend-co.github.io".equals(u.getHost()) &&
        (u.getPort()==-1 || u.getPort()==443) && u.getUserInfo()==null &&
        u.getPath()!=null && u.getPath().startsWith("/ticketing/") &&
        !u.getRawPath().contains("%") && !u.getPath().contains("/../");
    } catch(Exception e) {return false;}
  }
}
