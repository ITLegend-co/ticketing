package com.mountaintorq.helpdesk;
import org.junit.Test;
import org.json.JSONObject;
import static org.junit.Assert.*;

public class UploadWorkerTest {
  @Test public void lostAcknowledgementAcceptsSameTicketAfterITUpdates()throws Exception{
    JSONObject original=new JSONObject().put("requesterId","owner").put("createdAt",123);
    JSONObject existing=new JSONObject(original.toString()).put("status","Resolved").put("technicianId","it");
    UploadWorker.verify(existing,original);
  }
  @Test public void conflictingOwnerIsNotAccepted()throws Exception{
    JSONObject original=new JSONObject().put("requesterId","owner").put("createdAt",123);
    try{UploadWorker.verify(new JSONObject().put("requesterId","someone-else").put("createdAt",123),original);fail("must reject");}catch(UploadWorker.Problem expected){}
  }
  @Test public void conflictingTimestampIsNotAccepted()throws Exception{
    JSONObject original=new JSONObject().put("requesterId","owner").put("createdAt",123);
    try{UploadWorker.verify(new JSONObject().put("requesterId","owner").put("createdAt",456),original);fail("must reject");}catch(UploadWorker.Problem expected){}
  }
  @Test public void firstTicketCanReadEmptyFirebaseCollection()throws Exception{
    assertEquals(0,new UploadWorker.Response(200,"null").json().length());
  }
  @Test public void recordNamesRejectPathTraversal(){
    try{BackgroundStore.name("owner","../session");fail("must reject");}catch(IllegalArgumentException expected){}
    assertTrue(BackgroundStore.name("owner","-ticket123").startsWith("q-"));
  }
}
