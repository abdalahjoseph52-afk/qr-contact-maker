import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// --- DATA: ALL TANZANIAN REGIONS ---
const TZ_REGIONS = [
  "Dar es Salaam", "Arusha", "Dodoma", "Mwanza", "Kilimanjaro", "Mbeya", "Morogoro", 
  "Tanga", "Geita", "Kagera", "Mara", "Tabora", "Manyara", "Kigoma", "Mtwara", 
  "Lindi", "Ruvuma", "Iringa", "Njombe", "Songwe", "Rukwa", "Katavi", "Shinyanga", 
  "Simiyu", "Singida", "Pwani", "Zanzibar (Unguja)", "Pemba"
];

function App() {
  // --- STATE ---
  const [contact, setContact] = useState({
    firstName: '',
    lastName: '',
    company: '',
    jobTitle: '',
    email: '',
    website: '',
    street: '',
    region: 'Dar es Salaam', 
    country: 'Tanzania',
    // Default to two slots so you remember to fill them
    phones: [
      { number: '', type: 'CELL' },
      { number: '', type: 'WORK' } 
    ] 
  });

  const [qrColor, setQrColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [countryCode, setCountryCode] = useState('+255'); 
  const [vCardString, setVCardString] = useState('');
  
  const qrRef = useRef(null);

  // --- LOGIC: vCard 2.1 (Best for Samsung/Android) ---
  useEffect(() => {
    // 1. Format Phones (Using vCard 2.1 Syntax)
    // format: TEL;CELL;VOICE:+255... instead of TEL;TYPE=CELL...
    const phoneLines = contact.phones
      .filter(p => p.number.length > 3)
      .map(p => {
        const cleanNumber = p.number.startsWith('0') ? p.number.substring(1) : p.number;
        // Use the specific label selected by the user
        return `TEL;${p.type};VOICE:${countryCode}${cleanNumber}`;
      })
      .join('\n');

    // 2. Format Address (ADR)
    const addressLine = `ADR;WORK;PREF:;;${contact.street};${contact.region};;;${contact.country}`;

    // 3. Build vCard 2.1
    const vCard = `BEGIN:VCARD
VERSION:2.1
N:${contact.lastName};${contact.firstName}
FN:${contact.firstName} ${contact.lastName}
ORG:${contact.company}
TITLE:${contact.jobTitle}
${phoneLines}
${addressLine}
EMAIL;WORK;INTERNET:${contact.email}
URL:${contact.website}
END:VCARD`;

    setVCardString(vCard);
  }, [contact, countryCode, qrColor, bgColor]);

  // --- HANDLERS ---
  const handleChange = (e) => setContact({ ...contact, [e.target.name]: e.target.value });

  const handlePhoneChange = (index, field, value) => {
    const newPhones = [...contact.phones];
    newPhones[index][field] = value;
    setContact({ ...contact, phones: newPhones });
  };

  const addPhone = () => setContact({ ...contact, phones: [...contact.phones, { number: '', type: 'HOME' }] });
  
  const removePhone = (index) => {
    const newPhones = contact.phones.filter((_, i) => i !== index);
    setContact({ ...contact, phones: newPhones });
  };

  const downloadQR = (format) => {
    const canvas = qrRef.current.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.href = canvas.toDataURL(`image/${format}`);
      link.download = `${contact.firstName || 'contact'}_qr.${format}`;
      link.click();
    }
  };

  return (
    <div style={styles.page}>
      
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Corporate QR Generator</h1>
        </div>
      </header>

      <div style={styles.mainWrapper}>
        
        {/* LEFT COLUMN: EDITOR */}
        <div style={styles.editorColumn}>
          
          {/* Section 1: Identity */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Identity</h3>
            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>First Name</label>
                <input style={styles.input} name="firstName" onChange={handleChange} placeholder="First Name" />
              </div>
              <div>
                <label style={styles.label}>Last Name</label>
                <input style={styles.input} name="lastName" onChange={handleChange} placeholder="Last Name" />
              </div>
            </div>
            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>Company</label>
                <input style={styles.input} name="company" onChange={handleChange} placeholder="Company Name" />
              </div>
              <div>
                <label style={styles.label}>Job Title</label>
                <input style={styles.input} name="jobTitle" onChange={handleChange} placeholder="Position" />
              </div>
            </div>
          </div>

          {/* Section 2: Contact Info */}
          <div style={styles.card}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
               <h3 style={{...styles.cardTitle, marginBottom:0}}>Phone Numbers</h3>
               <button style={styles.addBtn} onClick={addPhone}>+ Add Number</button>
            </div>
            
            <div style={{marginBottom:'15px'}}>
               <label style={styles.label}>Country Code</label>
               <select style={styles.select} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                <option value="+255">🇹🇿 Tanzania (+255)</option>
                <option value="+254">🇰🇪 Kenya (+254)</option>
                <option value="+256">🇺🇬 Uganda (+256)</option>
                <option value="+1">🇺🇸 USA (+1)</option>
                <option value="+44">🇬🇧 UK (+44)</option>
               </select>
            </div>

            {contact.phones.map((phone, index) => (
              <div key={index} style={styles.phoneRow}>
                <input 
                  style={styles.phoneInput} 
                  placeholder="e.g. 755 123 456" 
                  value={phone.number}
                  onChange={(e) => handlePhoneChange(index, 'number', e.target.value)}
                />
                <select 
                  style={styles.typeSelect}
                  value={phone.type}
                  onChange={(e) => handlePhoneChange(index, 'type', e.target.value)}
                >
                  <option value="CELL">Mobile</option>
                  <option value="WORK">Work</option>
                  <option value="HOME">Home</option>
                  <option value="FAX">Fax</option>
                </select>
                {contact.phones.length > 1 && (
                  <button style={styles.deleteBtn} onClick={() => removePhone(index)}>×</button>
                )}
              </div>
            ))}
            <small style={{color:'#666', fontSize:'11px'}}>* Ensure you select different types (e.g. Mobile vs Work) for best results.</small>

            <div style={{marginTop: '20px'}}>
                <label style={styles.label}>Email Address</label>
                <input style={styles.input} name="email" onChange={handleChange} placeholder="email@company.com" />
                <label style={styles.label}>Website URL</label>
                <input style={styles.input} name="website" onChange={handleChange} placeholder="www.company.com" />
            </div>
          </div>

          {/* Section 3: Address */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Address & Location</h3>
            <label style={styles.label}>Street / Plot Number</label>
            <input style={styles.input} name="street" onChange={handleChange} placeholder="e.g. Plot 10, Ali Hassan Mwinyi Rd" />
            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>Region</label>
                <select style={styles.select} name="region" value={contact.region} onChange={handleChange}>
                  {TZ_REGIONS.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>Country</label>
                <input style={styles.input} name="country" defaultValue="Tanzania" onChange={handleChange} />
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: PREVIEW */}
        <div style={styles.previewColumn}>
          <div style={styles.stickyContainer}>
            <div style={styles.previewCard}>
              <h3 style={styles.cardTitleCenter}>Live Preview</h3>
              
              <div ref={qrRef} style={styles.qrBox}>
                <QRCodeCanvas 
                  value={vCardString} 
                  size={200} 
                  level={"L"} // Lower error correction = less dense QR = easier to scan
                  bgColor={bgColor}
                  fgColor={qrColor}
                  includeMargin={true}
                />
              </div>

              {/* Color Controls */}
              <div style={styles.colorRow}>
                <div style={styles.colorGroup}>
                   <span style={styles.miniLabel}>QR Color</span>
                   <input type="color" value={qrColor} onChange={(e) => setQrColor(e.target.value)} style={styles.colorInput}/>
                </div>
                <div style={styles.colorGroup}>
                   <span style={styles.miniLabel}>Background</span>
                   <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={styles.colorInput}/>
                </div>
              </div>

              <div style={styles.btnGroup}>
                <button style={styles.btnPrimary} onClick={() => downloadQR('png')}>Download PNG</button>
                <button style={styles.btnSecondary} onClick={() => downloadQR('jpeg')}>Download JPG</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- STYLES: FIXED CONTRAST & BACKGROUNDS ---
const styles = {
  // Page Layout
  page: { backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'Arial, sans-serif', paddingBottom: '50px' },
  header: { backgroundColor: '#0f2e53', padding: '20px 0', marginBottom: '30px', borderBottom: '4px solid #dbaa18' },
  headerContent: { maxWidth: '1000px', margin: '0 auto', padding: '0 20px' },
  title: { color: 'white', margin: 0, fontSize: '24px', fontWeight: 'bold' },
  mainWrapper: { maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '30px', padding: '0 20px', alignItems: 'flex-start', flexWrap: 'wrap' },
  editorColumn: { flex: 2, minWidth: '300px' },
  previewColumn: { flex: 1, minWidth: '300px' },
  card: { backgroundColor: '#ffffff', borderRadius: '8px', padding: '25px', marginBottom: '20px', border: '1px solid #e1e4e8', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
  previewCard: { backgroundColor: '#ffffff', borderRadius: '8px', padding: '25px', border: '1px solid #e1e4e8', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', textAlign: 'center' },
  stickyContainer: { position: 'sticky', top: '20px' },
  cardTitle: { marginTop: 0, marginBottom: '20px', color: '#1a1a1a', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  cardTitleCenter: { marginTop: 0, marginBottom: '20px', color: '#1a1a1a', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' },
  label: { display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#444' },
  miniLabel: { fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' },
  input: { width: '100%', padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '15px', color: '#333' },
  select: { width: '100%', padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px', color: '#333', cursor: 'pointer' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  phoneRow: { display: 'flex', gap: '10px', marginBottom: '10px' },
  phoneInput: { flex: 2, padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #ced4da', borderRadius: '4px', color: '#333' },
  typeSelect: { flex: 1, padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #ced4da', borderRadius: '4px', color: '#333' },
  addBtn: { backgroundColor: 'transparent', border: '1px dashed #0f2e53', color: '#0f2e53', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderRadius: '4px', fontWeight: 'bold' },
  deleteBtn: { backgroundColor: '#ffeaea', border: '1px solid #ffcccc', color: '#d00', cursor: 'pointer', padding: '0 12px', borderRadius: '4px', fontWeight: 'bold' },
  qrBox: { border: '1px solid #eee', padding: '15px', display: 'inline-block', marginBottom: '20px', backgroundColor: '#fafafa' },
  colorRow: { display: 'flex', justifyContent: 'center', gap: '30px', marginBottom: '20px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '8px' },
  colorGroup: { textAlign: 'center' },
  colorInput: { border: 'none', width: '40px', height: '40px', cursor: 'pointer', backgroundColor: 'transparent' },
  btnGroup: { display: 'flex', flexDirection: 'column', gap: '10px' },
  btnPrimary: { width: '100%', padding: '14px', backgroundColor: '#0f2e53', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px' },
  btnSecondary: { width: '100%', padding: '14px', backgroundColor: '#e2e6ea', color: '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }
};

export default App;