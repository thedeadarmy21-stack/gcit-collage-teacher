import { useEffect, useState, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config';

const Scan = () => {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [isFaceMode, setIsFaceMode] = useState(false); // 🚀 Face mode state
  
  const navigate = useNavigate();
  const location = useLocation();
  
  const codeReaderRef = useRef(null);
  const controlsRef = useRef(null);
  const videoRef = useRef(null); // Face scan ke liye
  
  const token = localStorage.getItem('teacherToken');
  const schoolName = "GCIT COLLAGE";

  const queryParams = new URLSearchParams(location.search);
  const targetClass = queryParams.get('class'); 

  useEffect(() => {
    if (!token) navigate('/');
    if (!targetClass) {
      alert("No class selected. Redirecting to home.");
      navigate('/home');
    }
    
    const fetchCount = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/attendance/today`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTodayCount(res.data.count);
      } catch (err) { console.log('Count error'); }
    };
    fetchCount();
  }, [token, navigate, targetClass]);

  // QR Scan Logic (Same as before)
  const startCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }

    setTimeout(() => {
      try {
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;

        codeReader.decodeFromVideoDevice(undefined, 'reader', (result, err) => {
          if (result) {
            if (controlsRef.current) controlsRef.current.stop();
            handleScanSuccess(result.getText());
          }
        }).then((controls) => {
          controlsRef.current = controls;
        }).catch((err) => {
          console.error("Camera Start Error:", err);
          setError("Camera start nahi ho raha.");
        });
      } catch (err) {
        console.error("Scanner Init Error:", err);
      }
    }, 500);
  };

  useEffect(() => {
    if (!token || !targetClass || isFaceMode) return;
    startCamera();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, [token, targetClass, isFaceMode]);

  // 🚀 Face Scan Logic (Placeholder - Face API will load here)
  const startFaceScan = () => {
    // Yahan hum face-api.js load karke camera start karenge
    setError("Face Recognition feature ready hai. (API integration needed)");
  };

  const handleScanSuccess = async (decodedText) => {
    if (loading) return;
    setLoading(true);
    setError('');
    setScanResult(null);

    try {
      const response = await axios.post(
        `${API_BASE}/api/attendance/scan`,
        { qrCode: decodedText, targetClass: targetClass }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setScanResult(response.data);
      setTodayCount(prev => prev + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Attendance failed. Try again.');
      if (controlsRef.current) controlsRef.current.stop();
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setError('');
    if (!isFaceMode) startCamera();
    navigate(`/scan?class=${targetClass}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col pb-20">
      <header className="bg-slate-800/80 backdrop-blur-md text-white p-4 shadow-lg rounded-b-3xl flex justify-between items-center sticky top-0 z-20 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold border border-green-500/30">
            {schoolName.charAt(0)}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">{schoolName}</h1>
            <p className="text-xs text-green-400 font-bold">Scanning Class {targetClass}</p>
          </div>
        </div>
        
        <div className="bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 font-bold text-sm">{todayCount} Present</span>
        </div>
      </header>

      {/* 🚀 TOGGLE BUTTON: QR vs Face */}
      <div className="flex justify-center mt-4 px-4">
        <div className="bg-slate-800 p-1 rounded-xl flex w-full max-w-sm border border-slate-700">
          <button 
            onClick={() => { setIsFaceMode(false); setScanResult(null); setError(''); }}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${!isFaceMode ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            📷 QR Scan
          </button>
          <button 
            onClick={() => { setIsFaceMode(true); setScanResult(null); setError(''); }}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${isFaceMode ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            😊 Face Scan
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 flex flex-col items-center mt-2">
        <div className="w-full max-w-sm bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700 relative">
          
          {!isFaceMode ? (
            // QR SCAN UI (Same as before)
            <div className={`p-4 relative ${scanResult || loading || error ? 'hidden' : 'block'}`}>
              <div className="absolute top-6 left-6 right-6 h-1 bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.9)] animate-scanline z-20 pointer-events-none rounded-full"></div>
              <video id="reader" className="w-full rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700"></video>
              <div className="mt-6 text-center">
                <p className="text-slate-300 text-sm font-medium flex items-center justify-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  Align QR code within the frame
                </p>
              </div>
            </div>
          ) : (
            // 🚀 FACE SCAN UI
            <div className="p-6 text-center">
              <div className="w-48 h-48 mx-auto rounded-full bg-slate-900 border-4 border-dashed border-green-500 flex items-center justify-center mb-6 relative overflow-hidden">
                 <span className="text-6xl">😊</span>
                 {/* Camera view will go here */}
              </div>
              <h3 className="text-white font-bold text-xl mb-2">Face Recognition</h3>
              <p className="text-slate-400 text-sm mb-6">Align face in circle & click start.</p>
              <button onClick={startFaceScan} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700">
                Start Face Scan
              </button>
            </div>
          )}

          {loading && (
            <div className="p-12 text-center animate-pulse">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-green-500 mb-4"></div>
              <p className="text-green-400 font-bold tracking-wider">MARKING ATTENDANCE...</p>
            </div>
          )}

          {error && (
            <div className="p-8 text-center animate-pop">
              <div className="text-5xl mb-4">⚠️</div>
              <div className="bg-red-900/30 text-red-400 p-4 rounded-xl border border-red-700/50 text-sm font-semibold mb-6">
                {error}
              </div>
              <button onClick={resetScanner} className="bg-slate-700 text-white px-6 py-3 rounded-xl font-bold w-full hover:bg-slate-600 transition">
                Try Again
              </button>
            </div>
          )}

          {scanResult && (
            <div className="p-8 text-center animate-pop">
              <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-500/30">
                <span className="text-6xl">✅</span>
              </div>
              <h3 className="text-2xl font-extrabold text-emerald-400 mb-1">Attendance Marked!</h3>
              <p className="text-slate-400 text-sm mb-6">Saved to database successfully.</p>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 mb-8 shadow-inner">
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Student Name</p>
                <p className="text-white text-xl font-bold">{scanResult.studentName}</p>
                <div className="h-px bg-slate-800 my-3"></div>
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Roll Number</p>
                <p className="text-slate-200 text-lg font-semibold">{scanResult.rollNumber}</p>
                <div className="h-px bg-slate-800 my-3"></div>
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Time In</p>
                <p className="text-green-400 text-lg font-bold">{scanResult.timeIn}</p>
              </div>
              <button onClick={resetScanner} className="bg-green-600 text-white px-6 py-4 rounded-xl font-bold w-full shadow-lg shadow-green-900/50 hover:bg-green-500 transition text-lg flex items-center justify-center gap-2">
                <span>📷</span> Scan Next Student
              </button>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 w-full bg-slate-800 border-t border-slate-700 flex justify-around p-3 pb-safe z-20">
        <button onClick={() => navigate('/home')} className="flex flex-col items-center text-slate-500 hover:text-green-500 transition-colors">
          <span className="text-2xl mb-1">🏠</span>
          <span className="text-[10px] font-bold tracking-wider">HOME</span>
        </button>
        <button className="flex flex-col items-center text-green-500">
          <span className="text-2xl mb-1">📷</span>
          <span className="text-[10px] font-bold tracking-wider">SCAN</span>
        </button>
        <button onClick={() => { localStorage.clear(); navigate('/'); }} className="flex flex-col items-center text-slate-500 hover:text-red-400 transition-colors">
          <span className="text-2xl mb-1">🚪</span>
          <span className="text-[10px] font-bold tracking-wider">LOGOUT</span>
        </button>
      </nav>
    </div>
  );
};

export default Scan;