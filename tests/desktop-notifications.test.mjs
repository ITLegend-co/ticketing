import test from 'node:test';
import assert from 'node:assert/strict';
import { desktopChanges, desktopRecipient } from '../src/desktop-notifications.ts';
const t={id:'one',subject:'Printer',requesterId:'employee',technicianId:'',status:'Open',priority:'Unreviewed'};
test('startup is quiet; new unassigned tickets notify admins only',()=>{
  assert.equal(desktopChanges(null,[t],'admin','IT Admin').length,0);
  assert.equal(desktopChanges([],[t],'admin','IT Admin').length,1);
  for(const role of ['IT Technician','Employee','Management'])assert.equal(desktopChanges([],[t],'other',role).length,0);
});
test('assignment and subsequent changes reach only the currently assigned IT person',()=>{
  const assigned={...t,technicianId:'tech'};
  assert.equal(desktopChanges([t],[assigned],'tech','IT Technician')[0].title,'Ticket assigned to you');
  const changed={...assigned,status:'Resolved',updatedBy:'admin'};
  assert.equal(desktopChanges([assigned],[changed],'tech','IT Technician').length,1);
  assert.equal(desktopChanges([assigned],[changed],'admin','IT Admin').length,0);
  assert.equal(desktopChanges([assigned],[changed],'other','IT Technician').length,0);
  const reassigned={...changed,technicianId:'other'};
  assert.equal(desktopChanges([changed],[reassigned],'tech','IT Technician').length,0);
  assert.equal(desktopChanges([changed],[reassigned],'other','IT Technician').length,1);
  assert.equal(desktopRecipient(reassigned,'tech','IT Technician'),false);
});
test('replies notify assignee, suppress own replies and unchanged snapshots',()=>{
  const assigned={...t,technicianId:'tech'};
  const replied={...assigned,updates:{a:{text:'Thanks',authorId:'employee',createdAt:1}}};
  assert.equal(desktopChanges([assigned],[replied],'tech','IT Technician').length,1);
  assert.equal(desktopChanges([replied],[replied],'tech','IT Technician').length,0);
  const own={...assigned,updates:{a:{text:'Fixed',authorId:'tech',createdAt:1}}};
  assert.equal(desktopChanges([assigned],[own],'tech','IT Technician').length,0);
  assert.equal(desktopChanges([assigned],[{...assigned,status:'Resolved',updatedBy:'tech'}],'tech','IT Technician').length,0);
});

test('normal staff receive only updates on their own requests, without self-notifications', () => {
  const assigned = {...t, technicianId:'tech'};
  const replied = {...assigned, updates:{a:{text:'Please restart',authorId:'tech',createdAt:1}}};
  for (const role of ['Employee','Management']) {
    assert.equal(desktopRecipient(assigned,'employee',role),true);
    assert.equal(desktopRecipient(assigned,'someone-else',role),false);
    assert.equal(desktopChanges(null,[replied],'employee',role).length,0);
    assert.equal(desktopChanges([],[t],'employee',role).length,0);
    assert.equal(desktopChanges([assigned],[replied],'employee',role)[0].title,'New ticket reply');
    assert.equal(desktopChanges([assigned],[replied],'someone-else',role).length,0);
    assert.equal(desktopChanges([assigned],[{...assigned,status:'Resolved',updatedBy:'tech'}],'employee',role).length,1);
    assert.equal(desktopChanges([assigned],[{...assigned,updates:{a:{text:'Thanks',authorId:'employee',createdAt:1}}}],'employee',role).length,0);
  }
  assert.equal(desktopRecipient(assigned,'employee','Unknown'),false);
});
