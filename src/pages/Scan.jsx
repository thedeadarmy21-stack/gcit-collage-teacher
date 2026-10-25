import { useEffect, useState, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import * as faceapi from 'face-api.js'; 
import { API_BASE } from '../config';

const Scan = () => {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [isFaceMode, setIsFaceMode] = useState(false); 
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceStatus, setFaceStatus] = useState('Initializing AI...');
  const [studentsData, setStudentsData] = useState([]); // 🚀 Student data cache

  const navigate = useNavigate();
  const location = useLocation();
  
  const codeReaderRef = useRef(null);
  const controlsRef = useRef(null);
  const videoRef = useRef(null);
  const faceIntervalRef = useRef(null);
  
  const token = localStorage.getItem('teacherToken');
  const schoolName = "GCIT COLLAGE";

  const queryParams = new URLSearchParams(location.search);
  const targetClass = queryParams.get('class'); 

  // 🚀 1. Load AI Models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
        setFaceStatus('AI Ready. Align face.');
      } catch (err) {
        console.error("Model Load Error:", err);
        setFaceStatus('AI Load Failed. Check console.');
      }
    };
    loadModels();
  }, []);

  // Fetch students data (taaki face match ke time bar-bar API call na karein)
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/students`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudentsData(res.data.students);
      } catch (err) {
        console.error("Error fetching students for face match", err);
      }
    };
    if (token) fetchStudents();
  }, [token]);

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

  // QR Scan Logic
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

  // 🚀 2. Face Scan Logic (Camera + Detection)
  const startFaceScan = async () => {
    if (!modelsLoaded) {
      setError("AI abhi load ho raha hai. Thoda wait karein.");
      return;
    }

    setError('');
    setFaceStatus('Starting Camera...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setFaceStatus('Scanning... Face dhoond raha hoon.');

      // Har 1 second me check karega
      faceIntervalRef.current = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === 4) {
          const detections = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
          
          if (detections) {
            setFaceStatus('Face Detected. Matching...');
            clearInterval(faceIntervalRef.current); // Rok do loop ko
            handleFaceMatch(detections.descriptor);
          }
        }
      }, 1000);
      
    } catch (err) {
      console.error("Face Camera Error:", err);
      setError("Camera on nahi ho paya. Permission check karein.");
    }
  };

  // 🚀 3. Match Face with Database (With Base64 Image Fix)
  const handleFaceMatch = async (descriptor) => {
    setLoading(true);
    try {
      let bestMatch = null;
      let minDistance = 0.6; // Threshold

      for (const student of studentsData) {
        if (!student.photo) continue;

        // Base64 ko HTML Image me convert karo taaki AI padh sake
        const img = new Image();
        img.src = student.photo;
        await new Promise((resolve) => { img.onload = resolve; });

        const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

        if (detection) {
          const distance = faceapi.euclideanDistance(descriptor, detection.descriptor);
          if (distance < minDistance) {
            minDistance = distance;
            bestMatch = student;
          }
        }
      }

      if (bestMatch) {
        await markAttendance(bestMatch.qrCode);
      } else {
        setError('Koi match nahi mila. Dobara koshish karein.');
        setFaceStatus('Match Failed.');
        setLoading(false);
        restartFaceScan();
      }

    } catch (err) {
      console.error("Face Match Error:", err);
      setError("Face match me error aya.");
      setLoading(false);
      restartFaceScan();
    }
  };

  // 🚀 4. Mark Attendance
  const markAttendance = async (qrCodeValue) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/attendance/scan`,
        { qrCode: qrCodeValue, targetClass: targetClass }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setScanResult(response.data);
      setTodayCount(prev => prev + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Attendance failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = (decodedText) => {
    if (loading) return;
    setLoading(true);
    setError('');
    setScanResult(null);
    markAttendance(decodedText);
  };

  const restartFaceScan = () => {
    setError('');
    setScanResult(null);
    setFaceStatus('Align face in circle.');
    startFaceScan();
  };

  const resetScanner = () => {
    setScanResult(null);
    setError('');
    if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
    
    if (isFaceMode) {
      restartFaceScan();
    } else {
      startCamera();
      navigate(`/scan?class=${targetClass}`, { replace: true });
    }
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

      {/* Toggle Button */}
      <div className="flex justify-center mt-4 px-4">
        <div className="bg-slate-800 p-1 rounded-xl flex w-full max-w-sm border border-slate-700">
          <button 
            onClick={() => { 
              setIsFaceMode(false); 
              setScanResult(null); 
              setError(''); 
              if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
              if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
              }
            }}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${!isFaceMode ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            📷 QR Scan
          </button>
          <button 
            onClick={() => { 
              setIsFaceMode(true); 
              setScanResult(null); 
              setError(''); 
              if (controlsRef.current) controlsRef.current.stop();
              if (modelsLoaded) startFaceScan();
            }}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${isFaceMode ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            😊 Face Scan
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 flex flex-col items-center mt-2">
        <div className="w-full max-w-sm bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700 relative">
          
          {!isFaceMode ? (
            // QR SCAN UI
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
            <div className={`p-6 text-center ${scanResult || loading || error ? 'hidden' : 'block'}`}>
              <div className="w-64 h-64 mx-auto rounded-full bg-slate-900 border-4 border-dashed border-green-500 flex items-center justify-center mb-6 relative overflow-hidden">
                 <video ref={videoRef} autoPlay muted className="absolute inset-0 w-full h-full object-cover"></video>
                 <div className="absolute inset-0 border-4 border-green-500/50 rounded-full animate-pulse pointer-events-none"></div>
              </div>
              <h3 className="text-white font-bold text-xl mb-2">AI Face Scan</h3>
              <p className={`text-sm mb-6 font-medium ${modelsLoaded ? 'text-green-400' : 'text-yellow-400 animate-pulse'}`}>
                {faceStatus}
              </p>
              {!modelsLoaded ? (
                <button disabled className="w-full bg-slate-600 text-slate-400 py-3 rounded-xl font-bold cursor-not-allowed">
                  Loading AI...
                </button>
              ) : (
                <button onClick={startFaceScan} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition">
                  Start Face Scan
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="p-12 text-center animate-pulse">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-green-500 mb-4"></div>
              <p className="text-green-400 font-bold tracking-wider">PROCESSING...</p>
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