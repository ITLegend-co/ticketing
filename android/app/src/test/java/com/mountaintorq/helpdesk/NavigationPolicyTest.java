package com.mountaintorq.helpdesk;
import org.junit.Test;
import static org.junit.Assert.*;
public class NavigationPolicyTest {
  @Test public void restrictsWebViewToHelpdesk(){
    assertTrue(NavigationPolicy.trusted("https://itlegend-co.github.io/ticketing/"));
    assertTrue(NavigationPolicy.trusted("https://itlegend-co.github.io/ticketing/askjaslhrui3893478rehfsj38uhef/?ticket=a"));
    for(String bad:new String[]{"http://itlegend-co.github.io/ticketing/","https://evil.example/ticketing/","https://itlegend-co.github.io/other/","https://itlegend-co.github.io/ticketing/../other/","https://itlegend-co.github.io/ticketing/%2e%2e/other/","javascript:alert(1)","file:///etc/passwd","https://user@itlegend-co.github.io/ticketing/"})assertFalse(bad,NavigationPolicy.trusted(bad));
  }
}
