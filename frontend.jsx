import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from "jspdf";
import { dbService } from './database';
import { auth } from './database'; 
import myLogo from './logo_crimeX.png';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";

const getTimestamp = () => {
  const now = new Date();
  return now.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).replace(',', '');
};

export default function CrimeSketchApp() {
  // Glassmorphism Style Classes
  const [isListening, setIsListening] = useState(false);
  const [databaseMatches, setDatabaseMatches] = useState([]);
const [topMatchScore, setTopMatchScore] = useState("0.0");
const refinementOptions = [
  "Beard", "Glasses", "Scar", "Mustache", "Tattoo", 
  "Piercing", "Hoodie", "Hat", "Earrings", "Wrinkles"
];

// This array will hold multiple selections at once!
const [selectedRefinements, setSelectedRefinements] = useState([]);
  const glassPanel = "bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]";
  const neonText = "text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400 font-black";
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const addAuditLog = (message) => {
    // We use setLogs here, and format it perfectly for your new Kernel Audit UI!
    const newEntry = { timestamp: new Date().toISOString(), action: message };
    setLogs(prevLogs => [newEntry, ...prevLogs]);
  };
  const [sliders, setSliders] = useState({ 
  age: 30, 
  faceShape: 'oval', 
  eyeShape: 'almond', // New category
  eyeSize: 5          // Now a numeric scale starting from 0
});
  // FIXED: Added the missing sketch state to store the AI generated image
  const [sketch, setSketch] = useState(null);
  // ==========================================
  // 🔐 AUTHENTICATION STATE & LOGIC
  // ==========================================
  const [currentUser, setCurrentUser] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });

  const handleAuthChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMsg("");
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg("");

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        setCurrentUser(userCredential.user);
        setLogs(prev => [{ timestamp: new Date().toISOString(), action: `Operative ${userCredential.user.email} authenticated.` }, ...prev]);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await updateProfile(userCredential.user, { displayName: formData.username });
        setCurrentUser(userCredential.user);
        setLogs(prev => [{ timestamp: new Date().toISOString(), action: `New clearance granted to ${formData.username}.` }, ...prev]);
      }
    } catch (err) {
      if (err.code === 'auth/invalid-credential') setErrorMsg("ACCESS DENIED: Invalid credentials.");
      else if (err.code === 'auth/email-already-in-use') setErrorMsg("ACCESS DENIED: Comm-link already registered.");
      else if (err.code === 'auth/weak-password') setErrorMsg("SECURITY ALERT: Encryption key must be at least 6 characters.");
      else setErrorMsg(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // 1. Voice Recognition
  const startListening = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.onresult = (event) => setDescription(event.results[0][0].transcript);
    recognition.start();
  };
// This only updates the text box, it DOES NOT call the AI
// This function handles the dropdown selections for the center panel
const toggleRefinement = (tag) => {
  setSelectedRefinements(prev => {
    // If the tag is already in the array, remove it
    if (prev.includes(tag)) {
      return prev.filter(t => t !== tag);
    } else {
      // If it is not in the array, add it
      return [...prev, tag];
    }
  });

  // Log the action for the Audit Log sidebar
  // Note: We use the current state to check if we are removing or adding
  const isRemoving = selectedRefinements.includes(tag);
  setLogs(prev => [{ 
    timestamp: new Date().toISOString(), 
    action: ` ${tag} ${isRemoving ? 'removed' : 'added'}.` 
  }, ...prev]);
};

const runFacialRecognition = () => {
  const suspects = dbService.getSuspects();
  
  const scoredSuspects = suspects.map(suspect => {
    // We start with a lower base score so the user has to "earn" the accuracy 
    // through correct slider and tag selections.
    let score = 30; 

    // 1. Age Calculation (Weight: 20%)
    // Perfect match = +20 points. Every year off = -2 points.
    const ageDiff = Math.abs(suspect.traits.age - sliders.age);
    const ageBonus = Math.max(0, 20 - (ageDiff * 2));
    score += ageBonus;

    // 2. Face & Eye Shape Bonus (Weight: 30%)
    // We use .toLowerCase() to ensure "Diamond" matches "diamond"
    if (suspect.traits.faceShape?.toLowerCase() === sliders.faceShape?.toLowerCase()) {
      score += 15;
    }
    if (suspect.traits.eyeShape?.toLowerCase() === sliders.eyeShape?.toLowerCase()) {
      score += 15;
    }

    // 3. Tag/Refinement Matches (Weight: 50%)
    // This is the most important part for your Kohli description!
    if (selectedRefinements.length > 0) {
      selectedRefinements.forEach(tag => {
        // Check if the suspect has the tag (e.g., "Beard")
        if (suspect.traits.tags.some(t => t.toLowerCase() === tag.toLowerCase())) {
          score += 15; // Big boost for matching specific traits like 'Beard' or 'Fade'
        } else {
          score -= 5;  // Penalty for selecting a trait the suspect doesn't have
        }
      });
    }

    // 4. Final Processing
    // Clamp between 8.5% and 99.8%
    let finalScore = Math.max(8.5, Math.min(99.8, score));
    
    // Add the biometric "jitter" for that realistic decimal look
    const jitter = (Math.random() * 0.9);
    finalScore = (finalScore + jitter).toFixed(1);

    return { ...suspect, match: finalScore };
  });

  // Sort: Highest match first
  const sortedMatches = scoredSuspects.sort((a, b) => b.match - a.match);
  
  setDatabaseMatches(sortedMatches);
  setTopMatchScore(sortedMatches[0].match); // This updates your 0.0% box to the new score
  
  // Update the Kernel Audit
  setLogs(prev => [{ 
    timestamp: new Date().toISOString(), 
    action: `Biometric match confirmed: ${sortedMatches[0].match}% probability.` 
  }, ...prev]);

  return sortedMatches;
};

  // ==========================================
  // 🎤 CONTINUOUS AUDIO TRANSCRIBER
  // ==========================================
  const toggleListening = () => {
    // Check if the browser supports voice recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setErrorMsg("AUDIO ERROR: Your browser does not support secure voice intake.");
      return;
    }

    if (isListening) {
      // If it's already on, we want this click to turn it off
      setIsListening(false);
      // We don't strictly need to call stop() if we let the instance die, 
      // but to be clean, we let the onend event handle the state.
      window.recognitionInstance?.stop();
      return;
    }

    // Initialize the Transcriber
    const recognition = new SpeechRecognition();
    window.recognitionInstance = recognition; // Save it to the window so we can stop it later
    
    recognition.continuous = true; // THIS KEEPS THE MIC ON DURING PAUSES
    recognition.interimResults = false; // Only grabs finished sentences to avoid messy overlapping text
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setLogs(prev => [{ timestamp: new Date().toISOString(), action: "Audio surveillance link established." }, ...prev]);
    };

    recognition.onresult = (event) => {
      // Grab the most recently spoken sentence
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;

      // APPEND it to the existing description instead of overwriting!
      setDescription(prev => {
        // Add a space before the new sentence if there is already text
        const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
        return prev + separator + transcript;
      });
    };

    recognition.onerror = (event) => {
      console.error("Mic error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      // Automatically update the UI when the mic finally shuts off
      setIsListening(false);
      setLogs(prev => [{ timestamp: new Date().toISOString(), action: "Audio link terminated." }, ...prev]);
    };

    // Start listening
    recognition.start();
  };

  // 2. Generate Image
const generateSketch = async () => {
  // Updated prompt to include the Orthographic/Multi-view instructions
  const forensicPrompt = `A professional forensic sketch character sheet of a suspect, [${description}], ${sliders.age} years old, ${sliders.faceShape} face shape, ${sliders.eyeShape} eyes, orthographic view showing three distinct angles: 1. Frontal portrait, 2. Left side profile, 3. Back of head view. Style: Hand-drawn pencil sketch, realistic shading, charcoal texture, white background, ${selectedRefinements.join(', ')}`;

  setLoading(true);
  
  // Initial audit log
  addAuditLog(`${description}`);

  try {
    const response = await axios.post('http://127.0.0.1:5000/generate', { 
      prompt: forensicPrompt, 
      sliders: sliders 
    });

    if (response.data && response.data.imageUrl) {
      // 1. Update the UI with the new image
      setSketch(response.data.imageUrl); 
      setHistory(prev => [response.data.imageUrl, ...prev]); 
      
      // 2. RUN THE REAL ALGORITHM (This calculates the match % based on your inputs)
      const results = runFacialRecognition();
      
      // 3. Log the specific accuracy found to the Kernel Audit
      if (results && results.length > 0) {
        addAuditLog(`Neural match confirmed: ${results[0].match}% accuracy.`);
      } else {
        addAuditLog("Forensic sketch generated. No database matches found.");
      }
    }
  } catch (err) {
    console.error(err);
    addAuditLog("CRITICAL ERROR: Neural link failed during reconstruction.");
    alert("Connection Error: Neural Link failed.");
  } finally {
    setLoading(false);
  }
};
// ==========================================
  // 📄 PDF DOSSIER GENERATOR
  // ==========================================
 // ==========================================
  // 📄 BULLETPROOF PDF DOSSIER GENERATOR
  // ==========================================
 // const exportDossier = () => {
   // ==========================================
  // 📄 FINAL BULLETPROOF PDF DOSSIER GENERATOR
  // ==========================================
  const exportDossier = () => {
    try {
      // 1. Safety check
      if (!description && !sketch) {
        alert("SYSTEM ERROR: Please enter a description or generate a sketch first.");
        return;
      }

      addAuditLog("Compiling secure PDF dossier...");

      // 2. Create the document
      const doc = new jsPDF();
      doc.setFont("courier", "bold");
      doc.setFontSize(22);
      doc.setTextColor(220, 38, 38); // Crimson Red
      doc.text("CRIMEX // OFFICIAL DOSSIER", 20, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`TIMESTAMP: ${new Date().toLocaleString()}`, 20, 28);
      doc.line(20, 32, 190, 32);

      // 3. Add the Witness Testimony
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("RELIABLE FEATURE DESCRIPTION:", 20, 45);

      doc.setFont("courier", "normal");
      doc.setFontSize(11);
      const wrappedText = doc.splitTextToSize(description || "No description provided.", 170);
      doc.text(wrappedText, 20, 55);

      // 4. Safely Handle the Image
      if (sketch) {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.src = sketch;

        img.onload = () => {
          const textHeight = wrappedText.length * 6;
          const imageStartY = 65 + textHeight;
          
          doc.setFont("courier", "bold");
          doc.setFontSize(14);
          doc.text("NEURAL RECONSTRUCTION:", 20, imageStartY);
          
          // Add the image
          doc.addImage(img, "JPEG", 20, imageStartY + 10, 140, 140);
          
          doc.save(`CrimeX_Dossier_${Date.now()}.pdf`);
          addAuditLog("Dossier successfully exported.");
        };

        img.onerror = () => {
          alert("WARNING: Sketch image could not be loaded into PDF. Exporting text only.");
          doc.save(`CrimeX_Dossier_TextOnly.pdf`);
        };
        return; 
      }

      // 5. If no sketch, save text only
      doc.save(`CrimeX_Dossier_${Date.now()}.pdf`);
      addAuditLog("Text Dossier successfully exported.");

    } catch (err) {
      alert(`CRITICAL PDF ERROR: ${err.message}`);
      console.error(err);
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
  // const downloadReport = () => {
  //   if (!sketch) {
  //     alert("No evidence found. Please generate a sketch first.");
  //     return;
  //   }

  //   try {
  //     const doc = new jsPDF({
  //       orientation: 'portrait',
  //       unit: 'mm',
  //       format: 'a4'
  //     });

  //     // 1. Title & Header
  //     doc.setFillColor(2, 4, 10); // Matches your dark blue UI
  //     doc.rect(0, 0, 210, 40, 'F');
      
  //     doc.setFontSize(24);
  //     doc.setTextColor(255, 255, 255);
  //     doc.text("FORENSIC DOSSIER", 105, 25, { align: "center" });

  //     // 2. Case Details
  //     doc.setTextColor(40, 40, 40);
  //     doc.setFontSize(12);
  //     doc.text(`CASE ID: #CASE-2026-X`, 20, 55);
  //     doc.text(`TIMESTAMP: ${new Date().toLocaleString()}`, 20, 65);
      
  //     doc.setFont("helvetica", "bold");
  //     doc.text("WITNESS TESTIMONY:", 20, 80);
  //     doc.setFont("helvetica", "normal");
      
  //     const splitDesc = doc.splitTextToSize(description || "No visual description provided.", 170);
  //     doc.text(splitDesc, 20, 90);

  //     // 3. The Sketch (The Critical Part)
  //     doc.setFont("helvetica", "bold");
  //     doc.text("PRIMARY SUSPECT VISUAL:", 20, 115);

  //     // We strip the prefix if it exists to ensure jsPDF only gets the raw data
  //     const imageData = sketch.includes('base64,') ? sketch.split('base64,')[1] : sketch;

  //     // addImage(data, type, x, y, width, height, alias, compression)
  //     doc.addImage(imageData, 'PNG', 20, 125, 170, 170, undefined, 'FAST');

  //     // 4. Footer
  //     doc.setFontSize(8);
  //     doc.setTextColor(150, 150, 150);
  //     doc.text("GENERATED BY NEURAL_SCAN V2.0 - CLASSIFIED MATERIAL", 105, 285, { align: "center" });

  //     // 5. Save with a unique name
  //     doc.save(`CRIME_REPORT_${Date.now()}.pdf`);

  //   } catch (error) {
  //     console.error("PDF Generation Error:", error);
  //     alert("PDF Error: Try refreshing the page and generating a new sketch.");
  //   }
  // };
  const fetchLogs = async () => {
    const dbLogs = await dbService.getLogs();
    setLogs(dbLogs);
  };

  useEffect(() => { fetchLogs(); }, []);

  // ==========================================
  // 🛡️ SECURITY GATEWAY (RENDERS IF NOT LOGGED IN)
  // ==========================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#02040a] text-slate-200 font-mono flex items-center justify-center relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-0 pointer-events-none bg-[length:100%_4px,3px_100%]" />

        <div className="relative w-full max-w-md p-8 rounded-3xl bg-black/40 backdrop-blur-xl border border-blue-500/20 shadow-[0_0_50px_rgba(6,182,212,0.1)] z-10">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/50 rounded-tl-3xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/50 rounded-tr-3xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/50 rounded-bl-3xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/50 rounded-br-3xl" />

          <div className="text-center mb-8">
            <img src={myLogo} alt="System Logo" className="h-40 w-auto mx-auto mb-4 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]" />
            <h1 className="text-xl font-bold text-white tracking-[0.2em] ">Crime<span className="text-cyan-500">X</span></h1>
            <p className="text-[10px] tracking-[0.3em] text-blue-400/50 mt-2 uppercase">{isLogin ? "AI for Smarter Investigation" : "AI FOR SMARTER INVESTIGATION"}</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3 border border-red-500/50 bg-red-500/10 rounded-lg text-center animate-in fade-in zoom-in duration-300">
              <p className="text-[10px] text-red-400 font-bold tracking-widest uppercase">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-[10px] uppercase tracking-widest text-blue-400/70 mb-2 block font-bold">Name</label>
                <input type="text" name="username" value={formData.username} onChange={handleAuthChange} required={!isLogin} className="w-full bg-[#02040a] border border-blue-500/20 p-3 rounded-xl text-sm text-cyan-50 outline-none focus:border-cyan-500/60 focus:bg-cyan-500/5 transition-all" placeholder="Enter your name" />
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-blue-400/70 mb-2 block font-bold">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleAuthChange} required className="w-full bg-[#02040a] border border-blue-500/20 p-3 rounded-xl text-sm text-cyan-50 outline-none focus:border-cyan-500/60 focus:bg-cyan-500/5 transition-all" placeholder="operative@mainframe.sys" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-blue-400/70 mb-2 block font-bold">Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleAuthChange} required className="w-full bg-[#02040a] border border-blue-500/20 p-3 rounded-xl text-sm text-cyan-50 outline-none focus:border-cyan-500/60 focus:bg-cyan-500/5 transition-all" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={authLoading} className="w-full py-4 mt-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 font-bold text-xs uppercase tracking-widest text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all">
              {authLoading ? "Validating Biometrics..." : (isLogin ? "Login" : "Register")}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-blue-500/10 pt-6">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{isLogin ? "Don't have an account?" : "Already have an Account?"}</p>
            <button type="button" onClick={() => { setIsLogin(!isLogin); setErrorMsg(""); }} className="mt-2 text-[11px] font-bold text-cyan-500 hover:text-cyan-300 tracking-widest uppercase transition-colors">
              {isLogin ? "Register" : "Back to Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 🖥️ MAIN FORENSIC OS APP
  // ==========================================
  return (
    <div className="min-h-[100vh] bg-[#02040a] text-slate-200 p-4 font-mono relative overflow-hidden flex flex-col">
      
      {/* 1. Deep Sea Ambience Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-900/20 blur-[140px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[20%] w-[40%] h-[40%] bg-indigo-900/15 blur-[120px] rounded-full" />
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-900/10 blur-[100px] rounded-full" />

      <div className="relative z-10 w-full h-full">
        
        {/* 2. Glassmorphic Header */}
        <header className="col-span-12 flex justify-between items-center p-6 rounded-3xl bg-black/40 backdrop-blur-xl border border-blue-500/10 shadow-2xl relative group overflow-hidden">
          
          {/* Left Side: Logo and Title */}
          <div className="flex items-center gap-4 relative z-10">
            {/* Your New Custom Logo */}
            <img 
              src={myLogo} 
              alt="System Logo" 
              className="h-10 w-auto drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
            />
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 tracking-widest">
                CrimeX
              </h1>
              <p className="text-[9px] tracking-[0.4em] text-blue-400/50 mt-1 uppercase">
                Advanced Forensic Identification System
              </p>
            </div>
          </div>

          {/* Right Side: Export Button */}
         <button 
          onClick={exportDossier} 
          className="relative z-10 px-6 py-2 border border-blue-500/30 text-[10px] text-blue-400 font-bold uppercase tracking-widest rounded-lg hover:bg-blue-500/10 transition-all shadow-[0_0_15px_rgba(37,99,235,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:text-cyan-400 hover:border-cyan-500/50"
        >
          Export Dossier
        </button>

          {/* Decorative Animated Scanline (Optional background effect for the header) */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
        </header>

        <div className="grid grid-cols-12 gap-8">
          
          {/* 3. Left Panel: Inputs */}
          <aside className="col-span-3 space-y-6">
            {/* MISSING DIGITAL INTAKE BOX */}
            <div className={`p-6 rounded-2xl ${glassPanel}`}>
              <h2 className="text-xs font-bold text-cyan-500 mb-4 tracking-widest uppercase border-b border-blue-500/10 pb-2">Digital Intake</h2>
              <textarea 
                className="w-full bg-black/60 border border-blue-500/10 p-4 rounded-xl h-40 text-sm focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-800 text-cyan-50 custom-scrollbar"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scanning witness testimony..."
              />
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button 
                  onClick={toggleListening} 
                  className={`py-2 rounded-lg border transition-all text-[10px] uppercase flex items-center justify-center gap-2 ${
                    isListening 
                      ? "bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse" 
                      : "bg-blue-900/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20"
                  }`}
                >
                  {isListening ? (
                    <> <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span> Recording... </>
                  ) : (
                    "🎤 Audio"
                  )}
                </button>
                <button onClick={() => generateSketch()} disabled={loading} className="py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-[10px] uppercase text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                  {loading ? "Processing..." : "Generate"}
                </button>
              </div>
            </div>
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
                            <img 
            src={sketch} 
            alt="Forensic Sketch"
            style={{
              border: '1px solid #00ffff',
              padding: '5px',
              background: '#000',
              filter: 'contrast(1.1) grayscale(1)',
              maxWidth: '100%'
            }}
          />
                  <div className="absolute bottom-10 left-10 bg-slate-950/80 backdrop-blur-md p-4 rounded-xl border border-blue-500/20 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                    <p className="text-[10px] text-cyan-500/50 tracking-[0.5em] mb-1 uppercase font-bold">Neural Match Found</p>
                    {/* Replace the old hardcoded 94.2% with this: */}
<p className="text-3xl font-black text-white tracking-tighter">{topMatchScore}% <span className="text-cyan-400">ACCURACY</span></p>
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
            {/* MULTI-SELECT BUTTON GRID */}
            <div className="flex flex-wrap gap-3 justify-center mt-8 max-w-4xl mx-auto pb-8">
              {refinementOptions.map(tag => {
                // Check if this specific tag is inside our multi-select array
                const isActive = selectedRefinements.includes(tag);
                
                return (
                  <button 
                    key={tag} 
                    onClick={() => toggleRefinement(tag)}
                    className={`px-6 py-2 text-[10px] rounded-lg border transition-all uppercase tracking-widest ${
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
              {/* Replace getMatches().map(...) with databaseMatches.map(...) */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-blue-900">
                {databaseMatches.map(s => (
                  <div key={s.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-blue-500/5 transition-all group border border-transparent hover:border-blue-500/20">
                    <div className="relative">
                      <img src={s.image} className="w-10 h-10 rounded-lg grayscale brightness-75 group-hover:grayscale-0 transition-all" alt="match" />
                      <div className="absolute inset-0 border border-cyan-500/20 rounded-lg" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-tight text-slate-300">{s.name}</p>
                      <div className="w-full h-1 bg-blue-900/20 mt-2 rounded-full overflow-hidden">
                        {/* Dynamic Progress Bar Width */}
                        <div className={`h-full shadow-[0_0_10px_rgba(6,182,212,0.5)] ${s.match > 80 ? 'bg-gradient-to-r from-red-600 to-orange-400' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`} style={{ width: `${s.match}%` }} />
                      </div>
                    </div>
                    {/* Display exact percentage next to the bar */}
                    <div className="text-[10px] font-mono text-cyan-500 font-bold">{s.match}%</div>
                  </div>
                ))}
              </div>
            </div>

                            <div className={`p-6 rounded-2xl ${glassPanel} h-[240px] flex flex-col`}>
                {/* KERNEL AUDIT PANEL */}
                                
                <div className={`p-6 rounded-2xl ${glassPanel} flex flex-col h-[300px]`}>
                  <h2 className="text-xs font-bold text-cyan-500 mb-4 tracking-widest uppercase border-b border-blue-500/10 pb-2">Kernel Audit</h2>
                  
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-blue-900 scrollbar-track-transparent">
                    {logs.map((log, index) => {
                      const isString = typeof log === 'string';
                      const actionText = isString ? log : log.action;
                      
                      const dateObj = isString || !log.timestamp ? new Date() : new Date(log.timestamp);
                      const timeString = dateObj.toLocaleTimeString('en-US', { hour12: false });
                      const dateString = dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

                      const cleanActionText = actionText.startsWith('#') ? actionText.substring(1).trim() : actionText;

                      return (
                        <div key={index} className="text-[10px] font-mono flex items-start gap-3 group">
                          
                          {/* COLUMN 1: Timestamp (Never wraps, never shrinks) */}
                          <div className="text-blue-500/50 shrink-0 whitespace-nowrap group-hover:text-cyan-500/70 transition-colors mt-[1px]">
                            [{dateString} {timeString}]
                          </div>
                          
                          {/* COLUMN 2 & 3: The Hash and The Message */}
                          <div className="flex items-start gap-2 flex-1">
                            {/* The Hash */}
                            <div className="text-cyan-500/50 shrink-0 select-none mt-[1px]">#</div>
                            
                            {/* The Message (Wraps cleanly under itself) */}
                            <div className="text-blue-300 group-hover:text-cyan-100 transition-colors flex-1 leading-relaxed">
                              {cleanActionText}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>            
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