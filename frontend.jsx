import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { dbService } from './database';

export default function CrimeSketchApp() {
  // Glassmorphism Style Classes
  const [selectedRefinements, setSelectedRefinements] = useState([]);

    const refinementOptions = [
    "Beard", "Glasses", "Scar", "Mustache", "Tattoo", 
    "Piercing", "Hoodie", "Hat", "Earrings", "Wrinkles"
    ];
  const glassPanel = "bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]";
  const neonText = "text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400 font-black";
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [sliders, setSliders] = useState({ 
  age: 30, 
  faceShape: 'oval', 
  eyeShape: 'almond', // New category
  eyeSize: 5          // Now a numeric scale starting from 0
});
  // FIXED: Added the missing sketch state to store the AI generated image
  const [sketch, setSketch] = useState(null);

  // 1. Voice Recognition
  const startListening = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.onresult = (event) => setDescription(event.results[0][0].transcript);
    recognition.start();
  };
// This only updates the text box, it DOES NOT call the AI
// This function handles the dropdown selections for the center panel
const handleRefinementChange = (category, value) => {
  setSelectedRefinements(prev => {
    const newRefinements = { ...prev };
    
    // Logic: If the user selects "none", remove that category entirely
    if (value === "none") {
      delete newRefinements[category];
    } else {
      // Otherwise, set/update the specific sub-option (e.g., { Glasses: "Aviators" })
      newRefinements[category] = value;
    }
    
    return newRefinements;
  });

  // Log the action for the Audit Log sidebar
  setLogs(prev => [{ 
    timestamp: new Date().toISOString(), 
    action: value === "none" 
      ? `System cleared: ${category} attribute removed.` 
      : `Neural link updated: ${category} set to ${value}.` 
  }, ...prev]);
};
  // 2. Generate Image
const generateSketch = async () => {
  // Combine typed description with all selected tags
  const combinedPrompt = `Forensic charcoal sketch, ${description}, ${sliders.age} years old, ${sliders.faceShape} face shape, ${sliders.eyeShape} eyes, eye size scale ${sliders.eyeSize}, ${selectedRefinements.join(', ')}`;
  setLoading(true);
  try {
    const response = await axios.post('http://127.0.0.1:5000/generate', { 
      prompt: combinedPrompt, // Now sends everything!
      sliders: sliders 
    });

    if (response.data && response.data.imageUrl) {
      setSketch(response.data.imageUrl); 
      setHistory(prev => [response.data.imageUrl, ...prev]); 
      setLogs(prev => [{ 
        timestamp: new Date().toISOString(), 
        action: `Neural reconstruction complete.` 
      }, ...prev]);
    }
  } catch (err) {
    console.error(err);
    alert("Connection Error: Neural Link failed.");
  } finally {
    setLoading(false);
  }
};

  // 3. Match Suspects
  const getMatches = () => {
    return dbService.getSuspects().map(s => ({
      ...s,
      match: Math.floor(Math.random() * (95 - 60 + 1)) + 60 
    }));
  };

  // 4. Export PDF
  // 4. Export PDF
  const downloadReport = () => {
    if (!sketch) {
      alert("No evidence found. Please generate a sketch first.");
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // 1. Title & Header
      doc.setFillColor(2, 4, 10); // Matches your dark blue UI
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text("FORENSIC DOSSIER", 105, 25, { align: "center" });

      // 2. Case Details
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(12);
      doc.text(`CASE ID: #CASE-2026-X`, 20, 55);
      doc.text(`TIMESTAMP: ${new Date().toLocaleString()}`, 20, 65);
      
      doc.setFont("helvetica", "bold");
      doc.text("WITNESS TESTIMONY:", 20, 80);
      doc.setFont("helvetica", "normal");
      
      const splitDesc = doc.splitTextToSize(description || "No visual description provided.", 170);
      doc.text(splitDesc, 20, 90);

      // 3. The Sketch (The Critical Part)
      doc.setFont("helvetica", "bold");
      doc.text("PRIMARY SUSPECT VISUAL:", 20, 115);

      // We strip the prefix if it exists to ensure jsPDF only gets the raw data
      const imageData = sketch.includes('base64,') ? sketch.split('base64,')[1] : sketch;

      // addImage(data, type, x, y, width, height, alias, compression)
      doc.addImage(imageData, 'PNG', 20, 125, 170, 170, undefined, 'FAST');

      // 4. Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("GENERATED BY NEURAL_SCAN V2.0 - CLASSIFIED MATERIAL", 105, 285, { align: "center" });

      // 5. Save with a unique name
      doc.save(`CRIME_REPORT_${Date.now()}.pdf`);

    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("PDF Error: Try refreshing the page and generating a new sketch.");
    }
  };
  const fetchLogs = async () => {
    const dbLogs = await dbService.getLogs();
    setLogs(dbLogs);
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="min-h-screen bg-[#02040a] text-slate-200 p-8 font-mono relative overflow-hidden">
      
      {/* 1. Deep Sea Ambience Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-900/20 blur-[140px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[20%] w-[40%] h-[40%] bg-indigo-900/15 blur-[120px] rounded-full" />
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-900/10 blur-[100px] rounded-full" />

      <div className="relative z-10 max-w-7xl mx-auto">
        
        {/* 2. Glassmorphic Header */}
        <header className={`flex justify-between items-center p-6 mb-8 rounded-2xl ${glassPanel}`}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <span className="text-white font-bold">C_OS</span>
            </div>
            <div>
              <h1 className={`text-3xl tracking-tighter ${neonText}`}>NEURAL_SCAN // OBSIDIAN</h1>
              <p className="text-[10px] tracking-[0.4em] text-blue-500/60 mt-1 uppercase">Advanced Forensic Identification System</p>
            </div>
          </div>
          <button 
  onClick={downloadReport} 
  className="group relative px-6 py-2 overflow-hidden rounded-lg bg-slate-900 border border-blue-500/30 font-bold text-blue-400 transition-all hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(37,99,235,0.2)]"
>
  <span className="relative z-10 text-xs tracking-widest uppercase">Export Dossier</span>
  <div className="absolute inset-0 bg-blue-500/10 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300" />
</button>
        </header>

        <div className="grid grid-cols-12 gap-8">
          
          {/* 3. Left Panel: Inputs */}
          <aside className="col-span-3 space-y-6">
            <div className={`p-6 rounded-2xl ${glassPanel}`}>
            <h2 className="text-xs font-bold text-cyan-500 mb-6 tracking-widest uppercase border-b border-blue-500/10 pb-2">Biometric Bias</h2>
            
            {/* AGE SLIDER (1 to 100) */}
            <div className="mb-6">
                <div className="flex justify-between text-[10px] text-blue-400/60 uppercase mb-2">
                <span>Age Range</span>
                <span className="text-cyan-400 font-bold">{sliders.age} YRS</span>
                </div>
                <input 
                type="range" min="1" max="100" value={sliders.age}
                className="w-full h-1 bg-blue-900/30 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
                onChange={(e) => setSliders({...sliders, age: e.target.value})} 
                />
            </div>

            {/* FACE SHAPE DROPDOWN */}
            <div className="mb-6">
                <label className="text-[10px] text-blue-400/60 uppercase mb-2 block">Face Structure</label>
                <select 
                className="w-full bg-black/60 border border-blue-500/10 p-2 rounded text-xs text-cyan-50 outline-none focus:border-cyan-500/50"
                value={sliders.faceShape}
                onChange={(e) => setSliders({...sliders, faceShape: e.target.value})}
                >
                <option value="oval">Oval</option>
                <option value="round">Round</option>
                <option value="square">Squarish</option>
                <option value="heart">Heart-shaped</option>
                <option value="diamond">Diamond</option>
                <option value="long">Oblong/Long</option>
                </select>
            </div>

            {/* EYE SHAPE DROPDOWN */}
            <div className="mb-6">
                <label className="text-[10px] text-blue-400/60 uppercase mb-2 block">Eye Shape</label>
                <select 
                className="w-full bg-black/60 border border-blue-500/10 p-2 rounded text-xs text-cyan-50 outline-none focus:border-cyan-500/50"
                value={sliders.eyeShape}
                onChange={(e) => setSliders({...sliders, eyeShape: e.target.value})}
                >
                <option value="almond">Almond</option>
                <option value="hooded">Hooded</option>
                <option value="monolid">Monolid</option>
                <option value="downturned">Downturned</option>
                <option value="upturned">Upturned</option>
                <option value="round">Round/Wide</option>
                </select>
            </div>

            {/* EYE SIZE SLIDER (Starts at 0) */}
            <div className="mb-6">
                <div className="flex justify-between text-[10px] text-blue-400/60 uppercase mb-2">
                <span>Eye Scale</span>
                <span className="text-cyan-400 font-bold">{sliders.eyeSize}</span>
                </div>
                <input 
                type="range" min="0" max="10" value={sliders.eyeSize}
                className="w-full h-1 bg-blue-900/30 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
                onChange={(e) => setSliders({...sliders, eyeSize: e.target.value})} 
                />
            </div>
            </div>
          </aside>

          {/* 4. Center Panel: Primary Canvas */}
          <main className="col-span-6">
            <div className={`p-4 rounded-3xl ${glassPanel} min-h-[520px] flex items-center justify-center relative overflow-hidden group border-blue-500/5`}>
              {/* UI Scanner Lines */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%]" />
              
              {/* Cyberpunk Corner Accents */}
              <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-cyan-500/40" />
              <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-cyan-500/40" />
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-cyan-500/40" />
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-cyan-500/40" />

              {sketch ? (
                <div className="relative w-full h-full p-2 animate-in zoom-in-95 duration-700">
                  <img src={sketch} alt="Suspect" className="w-full h-full object-cover rounded-2xl grayscale brightness-110 contrast-125 sepia-[0.2] blue-filter" />
                  <div className="absolute bottom-10 left-10 bg-slate-950/80 backdrop-blur-md p-4 rounded-xl border border-blue-500/20 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                    <p className="text-[10px] text-cyan-500/50 tracking-[0.5em] mb-1 uppercase font-bold">Neural Match Found</p>
                    <p className="text-3xl font-black text-white tracking-tighter">94.2% <span className="text-cyan-400">ACCURACY</span></p>
                  </div>
                </div>
              ) : (
                <div className="text-center relative z-20">
                  <div className="w-24 h-24 border-2 border-blue-900/30 border-t-cyan-500 rounded-full animate-spin mb-6 mx-auto shadow-[0_0_30px_rgba(6,182,212,0.2)]" />
                  <p className="text-[10px] tracking-[0.6em] text-blue-400/40 animate-pulse uppercase">Syncing with Mainframe...</p>
                </div>
              )}
            </div>
            
            {/* NEW UPDATED CODE: */}
            <div className="flex flex-wrap gap-3 justify-center mt-8 max-w-2xl mx-auto">
            {refinementOptions.map(tag => {
                const isActive = selectedRefinements.includes(tag);
                return (
                <button 
                    key={tag} 
                    onClick={() => toggleRefinement(tag)}
                    className={`px-4 py-2 text-[10px] rounded-lg border transition-all uppercase tracking-widest ${
                    isActive 
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]" 
                        : "border-blue-500/10 bg-blue-500/5 text-blue-400 hover:border-blue-500/40"
                    }`}
                >
                    {isActive ? `✓ ${tag}` : `+ ${tag}`}
                </button>
                );
            })}
            </div>
          </main>

          {/* 5. Right Panel: Intelligence & Logs */}
          <aside className="col-span-3 space-y-6">
            <div className={`p-6 rounded-2xl ${glassPanel} h-[320px] flex flex-col`}>
              <h2 className="text-xs font-bold text-cyan-500 mb-4 tracking-widest uppercase border-b border-blue-500/10 pb-2">Database Index</h2>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-blue-900">
                {getMatches().map(s => (
                  <div key={s.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-blue-500/5 transition-all group border border-transparent hover:border-blue-500/20">
                    <div className="relative">
                      <img src={s.image} className="w-10 h-10 rounded-lg grayscale brightness-75 group-hover:grayscale-0 transition-all" alt="match" />
                      <div className="absolute inset-0 border border-cyan-500/20 rounded-lg" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-tight text-slate-300">{s.name}</p>
                      <div className="w-full h-1 bg-blue-900/20 mt-2 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]" style={{ width: `${s.match}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-6 rounded-2xl ${glassPanel} h-[240px] flex flex-col`}>
              <h2 className="text-xs font-bold text-cyan-500 mb-4 tracking-widest uppercase border-b border-blue-500/10 pb-2">Kernel Audit</h2>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 text-[9px] text-blue-400/40 font-mono">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2 items-start border-l border-blue-500/10 pl-2">
                    <span className="text-cyan-600 font-black tracking-tighter">#</span>
                    <span className="text-slate-400">{log.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}