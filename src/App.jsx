import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  LayoutDashboard, Users, FileText, Settings, Download, 
  Menu, X, CheckCircle, Grid, Phone, Briefcase, 
  MapPin, Globe, Mail, User, Building, AlertCircle
} from 'lucide-react';

const TZ_REGIONS = [
  "Dar es Salaam", "Arusha", "Dodoma", "Mwanza", "Kilimanjaro", "Mbeya", "Morogoro", 
  "Tanga", "Geita", "Kagera", "Mara", "Tabora", "Manyara", "Kigoma", "Mtwara", 
  "Lindi", "Ruvuma", "Iringa", "Njombe", "Songwe", "Rukwa", "Katavi", "Shinyanga", 
  "Simiyu", "Singida", "Pwani", "Zanzibar (Unguja)", "Pemba"
];

function App() {
  const [mode, setMode] = useState('single');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // --- GLOBAL SETTINGS ---
  const [qrColor, setQrColor] = useState('#1e293b'); 
  const [bgColor, setBgColor] = useState('#ffffff');

  // --- SINGLE ENTRY STATE ---
  const [contact, setContact] = useState({
    firstName: '', lastName: '', company: '', jobTitle: '',
    email: '', website: '', street: '', region: 'Dar es Salaam', country: 'Tanzania',
    phones: [{ number: '', type: 'CELL' }] 
  });

  // --- BULK ENTRY STATE ---
  const [bulkText, setBulkText] = useState('');
  // Removed defaultCompany state as requested
  const [bulkContacts, setBulkContacts] = useState([]);

  // --- LOGIC: SMART PARSER ---
  const parseBulkData = () => {
    if (!bulkText) { setBulkContacts([]); return; }
    
    const lines = bulkText.split('\n');
    const parsedContacts = [];
    
    let currentRegion = 'Tanzania'; 
    let currentContact = null;

    const saveCurrentContact = () => {
        if (currentContact) {
            // Only push if it has at least a name or a phone number
            if (currentContact.firstName || currentContact.phones.length > 0) {
                parsedContacts.push(currentContact);
            }
        }
        currentContact = null;
    };

    lines.forEach(line => {
      let cleanLine = line.replace(/\t/g, ' ').trim();
      const lowerLine = cleanLine.toLowerCase();
      
      if (!cleanLine) return; 

      // 1. Detect Location Headers
      if (cleanLine.includes('📍')) {
        currentRegion = cleanLine.replace('📍', '').replace(/REGION/i, '').trim();
        return; 
      } 
      
      // 2. Detect New Contact Triggers
      const isNumberStart = /^\d+[\.)]/.test(cleanLine);
      const isLabelStart = lowerLine.startsWith('first name') || lowerLine.startsWith('name:');
      
      if (isNumberStart || isLabelStart) {
         if (currentContact && (currentContact.firstName || currentContact.phones.length > 0)) {
             saveCurrentContact();
         }
         
         if (!currentContact) {
             currentContact = {
                region: currentRegion, country: 'Tanzania', phones: [],
                firstName: '', lastName: '', company: '', jobTitle: '', email: '', website: '', street: ''
             };
         }

         if (isNumberStart) {
             const textAfterNumber = cleanLine.replace(/^\d+[\.)]\s*/, '');
             if (textAfterNumber) {
                 cleanLine = textAfterNumber; 
             } else {
                 return; 
             }
         }
      } 
      
      // 3. Smart Field Filling
      if (currentContact) {
         if (cleanLine.includes(':')) {
            const parts = cleanLine.split(':');
            const key = parts[0].trim().toLowerCase();
            const val = parts.slice(1).join(':').trim();

            if (key.includes('first') || key === 'name') currentContact.firstName = val;
            else if (key.includes('last')) currentContact.lastName = val;
            else if (key.includes('company') || key.includes('org') || key.includes('biashara')) currentContact.company = val;
            else if (key.includes('job') || key.includes('title') || key.includes('cheo')) currentContact.jobTitle = val;
            else if (key.includes('email') || key.includes('barua')) currentContact.email = val;
            else if (key.includes('web') || key.includes('url')) currentContact.website = val;
            else if (key.includes('address') || key.includes('loc') || key.includes('anwani')) currentContact.street = val;
            else if (key.includes('phone') || key.includes('mobile') || key.includes('simu') || key.includes('tel')) {
               val.split(/[\/,]/).forEach(n => {
                  if(n.trim().length > 3) currentContact.phones.push({ number: n.trim(), type: 'CELL' });
               });
            }
         }
         else {
            if (cleanLine.includes('@') && cleanLine.includes('.')) {
               currentContact.email = cleanLine;
            }
            else if (lowerLine.startsWith('http') || lowerLine.startsWith('www')) {
               currentContact.website = cleanLine;
            }
            else if (/^[\+\d\s\-\(\)]{9,}$/.test(cleanLine)) {
               currentContact.phones.push({ number: cleanLine, type: 'CELL' });
            }
            else if (!currentContact.firstName && cleanLine.length > 2 && cleanLine.length < 40) {
               const names = cleanLine.split(' ');
               if (names.length > 1) {
                   currentContact.firstName = names[0];
                   currentContact.lastName = names.slice(1).join(' ');
               } else {
                   currentContact.firstName = cleanLine;
               }
            }
         }
      }
    });

    saveCurrentContact();
    setBulkContacts(parsedContacts);
  };

  useEffect(() => {
    parseBulkData();
  }, [bulkText]);

  // --- GENERATORS ---
  const generateVCard = (c) => {
    const phoneLines = c.phones.map(p => {
        const clean = p.number.replace(/\s+/g, ''); 
        let finalNum = clean;
        if (clean.startsWith('0')) finalNum = `+255${clean.substring(1)}`;
        return `TEL;${p.type};VOICE:${finalNum}`;
    }).join('\n');
    const addressLine = `ADR;WORK;PREF:;;${c.street};${c.region};;;${c.country}`;

    return `BEGIN:VCARD
VERSION:2.1
N:${c.lastName};${c.firstName}
FN:${c.firstName} ${c.lastName}
ORG:${c.company || ''}
TITLE:${c.jobTitle || ''}
${phoneLines}
${addressLine}
EMAIL;WORK;INTERNET:${c.email || ''}
URL:${c.website || ''}
END:VCARD`;
  };

  const downloadAllZip = async (format) => {
    const zip = new JSZip();
    const folder = zip.folder("QR_Codes");
    bulkContacts.forEach((c, index) => {
      const canvas = document.getElementById(`qr-canvas-${index}`);
      if (canvas) {
        const dataUrl = canvas.toDataURL(`image/${format}`).split(',')[1];
        folder.file(`${c.firstName}_${c.lastName}_${c.region}.${format}`, dataUrl, { base64: true });
      }
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `Batch_QRs_${format.toUpperCase()}.zip`);
  };

  const downloadSingle = (format) => {
    const canvas = document.getElementById('single-qr');
    if(canvas) {
        const link = document.createElement('a');
        link.href = canvas.toDataURL(`image/${format}`);
        link.download = `${contact.firstName}_QR.${format}`;
        link.click();
    }
  };

  const handleSingleChange = (e) => setContact({ ...contact, [e.target.name]: e.target.value });
  const handlePhoneChange = (idx, field, val) => {
    const newPhones = [...contact.phones];
    newPhones[idx][field] = val;
    setContact({ ...contact, phones: newPhones });
  };
  const addPhone = () => setContact({ ...contact, phones: [...contact.phones, { number: '', type: 'CELL' }] });

  return (
    <div className="app-shell">
      <style>{`
        :root {
          --primary: #1e293b;   /* Midnight Navy */
          --secondary: #0f172a; /* Darker Navy */
          --accent: #d97706;    /* Professional Gold */
          --bg-body: #f1f5f9;   
          --bg-panel: #ffffff;
          --border: #e2e8f0;
          --text-main: #334155;
          --text-muted: #64748b;
        }

        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; background: var(--bg-body); color: var(--text-main); height: 100vh; overflow: hidden; }

        /* LAYOUT */
        .app-shell { display: flex; height: 100vh; width: 100vw; }
        
        /* SIDEBAR */
        .sidebar { width: 260px; background: var(--primary); color: white; display: flex; flex-direction: column; flex-shrink: 0; transition: transform 0.3s ease; z-index: 50; box-shadow: 4px 0 24px rgba(0,0,0,0.1); }
        .logo-section { height: 70px; display: flex; align-items: center; padding: 0 24px; font-size: 1.25rem; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.1); letter-spacing: -0.5px; }
        .nav-menu { padding: 20px 15px; flex: 1; }
        .nav-link { display: flex; align-items: center; gap: 12px; padding: 14px 16px; color: #94a3b8; text-decoration: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; margin-bottom: 8px; font-weight: 500; }
        .nav-link:hover { background: rgba(255,255,255,0.05); color: white; transform: translateX(5px); }
        .nav-link.active { background: var(--accent); color: white; font-weight: 700; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.4); }
        .sidebar-footer { padding: 20px; font-size: 0.75rem; color: #64748b; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); }

        /* MAIN CONTENT */
        .main-content { flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; }
        .top-toolbar { height: 70px; background: var(--bg-panel); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 30px; }
        
        /* SETTINGS */
        .settings-area { display: flex; align-items: center; gap: 20px; }
        .setting-item { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }
        .color-trigger { width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; position: relative; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1); transition: transform 0.2s; }
        .color-trigger:hover { transform: scale(1.1); border-color: var(--accent); }
        .native-color-input { position: absolute; top: -10px; left: -10px; width: 60px; height: 60px; opacity: 0; cursor: pointer; }

        /* WORKSPACE */
        .workspace { flex: 1; overflow-y: auto; padding: 30px; background: var(--bg-body); }
        .split-view { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; height: 100%; min-height: 0; }
        
        /* PANELS */
        .panel { background: var(--bg-panel); border-radius: 12px; border: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; height: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .panel-head { padding: 15px 24px; background: #f8fafc; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .panel-title { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--primary); display: flex; align-items: center; gap: 8px; }
        .panel-body { padding: 0; overflow-y: auto; flex: 1; display: flex; flex-direction: column; }
        
        /* INPUTS */
        .input-pad { padding: 24px; }
        .field-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block; }
        .field-input { width: 100%; padding: 12px; border-radius: 6px; border: 1px solid var(--border); background: #fff; font-size: 0.95rem; color: var(--text-main); }
        .field-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(30, 41, 59, 0.1); }
        
        /* UPDATED BULK TEXTAREA STYLE */
        .bulk-textarea { 
            width: 100%; 
            flex: 1; 
            border: none; 
            resize: none; 
            font-family: 'Monaco', monospace; 
            font-size: 14px; 
            line-height: 1.6; 
            color: #1e293b; /* Dark Navy text for high contrast */
            background-color: #ffffff; /* Pure White background */
            padding: 20px; 
            outline: none; 
        }
        
        /* BUTTONS */
        .btn { padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer; border: none; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--secondary); }
        .btn-outline { background: white; border: 1px solid var(--border); color: var(--text-main); }
        .btn-outline:hover { border-color: var(--primary); color: var(--primary); }

        /* RESULTS GRID */
        .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; padding: 20px; }
        .grid-item { background: white; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .grid-preview { padding: 15px; display: flex; justify-content: center; background: #f8fafc; border-bottom: 1px solid var(--border); }
        .grid-details { padding: 12px; }
        .grid-name { font-weight: 700; font-size: 0.9rem; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .grid-sub { font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* PREVIEW CARD */
        .preview-stage { align-items: center; justify-content: center; background: #f8fafc; height: 100%; }
        .preview-card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1); border: 1px solid var(--border); text-align: center; }
        
        /* INSTRUCTION BOX */
        .info-box { background: #fffbeb; border-bottom: 1px solid #fcd34d; padding: 15px 20px; display: flex; gap: 10px; align-items: start; color: #92400e; font-size: 0.85rem; line-height: 1.5; }

        /* RESPONSIVE */
        .mobile-menu-btn { display: none; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--primary); }
        @media (max-width: 1024px) {
           .split-view { grid-template-columns: 1fr; grid-template-rows: auto auto; display: block; overflow-y: auto; }
           .panel { height: auto; min-height: 500px; margin-bottom: 30px; }
        }
        @media (max-width: 768px) {
           .sidebar { position: absolute; height: 100%; transform: translateX(-100%); }
           .sidebar.open { transform: translateX(0); }
           .mobile-menu-btn { display: block; }
           .top-toolbar { padding: 0 15px; }
           .settings-area { gap: 10px; }
           .setting-item span { display: none; }
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="logo-section">PRIME QR <span style={{color:'var(--accent)', marginLeft:'5px'}}>PRO</span></div>
        <nav className="nav-menu">
          <div className={`nav-link ${mode === 'single' ? 'active' : ''}`} onClick={() => {setMode('single'); setIsMobileMenuOpen(false);}}>
            <LayoutDashboard size={18} /> Single Entry
          </div>
          <div className={`nav-link ${mode === 'bulk' ? 'active' : ''}`} onClick={() => {setMode('bulk'); setIsMobileMenuOpen(false);}}>
            <Users size={18} /> Bulk Generator
          </div>
        </nav>
        <div className="sidebar-footer">&copy; 2026 PowerPixel Solution<br/>Enterprise Edition</div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="top-toolbar">
          <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
            <div className="page-header">
              {mode === 'single' ? 'New Contact' : 'Bulk Data Processor'}
            </div>
          </div>

          <div className="settings-area">
             <div className="setting-item">
               <span>Color</span>
               <div className="color-trigger" style={{background: qrColor}}>
                 <input type="color" className="native-color-input" value={qrColor} onChange={(e) => setQrColor(e.target.value)} />
               </div>
             </div>
             <div className="setting-item">
               <span>Bg</span>
               <div className="color-trigger" style={{background: bgColor}}>
                 <input type="color" className="native-color-input" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
               </div>
             </div>
          </div>
        </header>

        <div className="workspace">
          
          {/* ===================== BULK MODE ===================== */}
          {mode === 'bulk' && (
            <div className="split-view">
              
              {/* LEFT: INPUT */}
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title"><FileText size={16}/> Input Data</div>
                </div>
                
                {/* INSTRUCTION BOX (REPLACED DEFAULT COMPANY INPUT) */}
                <div className="info-box">
                   <AlertCircle size={18} style={{flexShrink:0, marginTop:2}}/>
                   <div>
                     <strong>Attention:</strong> For massive data entry, please ensure that every entry in your list includes all necessary fields (First Name, Last Name, Phone, Company, etc.) to ensure accurate generation.
                   </div>
                </div>

                <div className="panel-body">
                  <textarea 
                    className="bulk-textarea"
                    placeholder="Paste your formatted data list here..."
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                  />
                </div>
              </div>

              {/* RIGHT: RESULTS */}
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title"><CheckCircle size={16}/> {bulkContacts.length} Results</div>
                  <div style={{display:'flex', gap:'8px'}}>
                    <button className="btn btn-outline" onClick={() => downloadAllZip('png')}><Download size={14}/> PNG</button>
                    <button className="btn btn-outline" onClick={() => downloadAllZip('jpeg')}><Download size={14}/> JPG</button>
                  </div>
                </div>
                <div className="panel-body" style={{background:'#f8fafc'}}>
                   {bulkContacts.length === 0 ? (
                      <div style={{textAlign:'center', marginTop:'100px', color:'#94a3b8'}}>
                         <Grid size={48} style={{opacity:0.2, marginBottom:'10px'}}/>
                         <p>Waiting for data...</p>
                      </div>
                   ) : (
                      <div className="grid-container">
                        {bulkContacts.map((c, idx) => (
                          <div key={idx} className="grid-item">
                            <div className="grid-preview">
                              <QRCodeCanvas id={`qr-canvas-${idx}`} value={generateVCard(c)} size={100} level="L" fgColor={qrColor} bgColor={bgColor} />
                            </div>
                            <div className="grid-details">
                              <div className="grid-name">{c.firstName} {c.lastName}</div>
                              <div className="grid-sub" style={{color:'var(--accent)', fontWeight:'700'}}>{c.company || 'No Company'}</div>
                              <div className="grid-sub">{c.region}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                   )}
                </div>
              </div>

            </div>
          )}

          {/* ===================== SINGLE MODE ===================== */}
          {mode === 'single' && (
            <div className="split-view">
              
              {/* LEFT: FORM */}
              <div className="panel">
                <div className="panel-head"><div className="panel-title"><User size={16}/> Details</div></div>
                <div className="panel-body input-pad">
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                      <div><label className="field-label">First Name</label><input className="field-input" name="firstName" onChange={handleSingleChange}/></div>
                      <div><label className="field-label">Last Name</label><input className="field-input" name="lastName" onChange={handleSingleChange}/></div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                      <div><label className="field-label">Company</label><input className="field-input" name="company" onChange={handleSingleChange}/></div>
                      <div><label className="field-label">Job Title</label><input className="field-input" name="jobTitle" onChange={handleSingleChange}/></div>
                   </div>
                   
                   <div style={{marginBottom:'20px'}}>
                      <label className="field-label">Phone Numbers</label>
                      {contact.phones.map((p, i) => (
                        <div key={i} style={{display:'flex', gap:'10px', marginBottom:'8px'}}>
                           <input className="field-input" style={{flex:2}} value={p.number} onChange={(e)=>handlePhoneChange(i,'number',e.target.value)} placeholder="+255..."/>
                           <select className="field-input" style={{flex:1}} value={p.type} onChange={(e)=>handlePhoneChange(i,'type',e.target.value)}>
                              <option value="CELL">Mobile</option><option value="WORK">Work</option>
                           </select>
                        </div>
                      ))}
                      <button style={{background:'none', border:'none', color:'var(--accent)', fontWeight:'700', fontSize:'0.8rem', cursor:'pointer', padding:0}} onClick={addPhone}>+ Add Number</button>
                   </div>

                   <div style={{marginBottom:'15px'}}><label className="field-label">Email</label><input className="field-input" name="email" onChange={handleSingleChange}/></div>
                   <div style={{marginBottom:'15px'}}><label className="field-label">Website</label><input className="field-input" name="website" onChange={handleSingleChange}/></div>
                   
                   <div>
                      <label className="field-label">Location</label>
                      <input className="field-input" name="street" placeholder="Street" style={{marginBottom:'10px'}} onChange={handleSingleChange}/>
                      <div style={{display:'flex', gap:'10px'}}>
                         <select className="field-input" name="region" value={contact.region} onChange={handleSingleChange}>
                            {TZ_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                         <input className="field-input" name="country" defaultValue="Tanzania" onChange={handleSingleChange}/>
                      </div>
                   </div>
                </div>
              </div>

              {/* RIGHT: PREVIEW */}
              <div className="panel">
                <div className="panel-head"><div className="panel-title"><Settings size={16}/> Preview</div></div>
                <div className="panel-body preview-stage">
                   <div className="preview-card">
                      <QRCodeCanvas id="single-qr" value={generateVCard(contact)} size={220} fgColor={qrColor} bgColor={bgColor} />
                      <div style={{marginTop:'20px', fontSize:'1.2rem', fontWeight:'800', color:'var(--primary)'}}>{contact.firstName || 'Name'} {contact.lastName || 'Here'}</div>
                      <div style={{color:'var(--accent)', fontWeight:'600', fontSize:'0.9rem'}}>{contact.company || 'Company Name'}</div>
                   </div>
                   <div style={{display:'flex', gap:'15px', marginTop:'30px'}}>
                      <button className="btn btn-primary" onClick={() => downloadSingle('png')}><Download size={16}/> PNG</button>
                      <button className="btn btn-outline" onClick={() => downloadSingle('jpeg')}>JPG</button>
                   </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;