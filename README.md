# ⏳ TimeDial: Immersive History Teacher
### *Talk to history, face-to-face.*

![Google Cloud](https://img.shields.io/badge/Google_Cloud-Vertex_AI-blue?style=for-the-badge&logo=googlecloud)
![Gemini 3.0](https://img.shields.io/badge/AI_Model-Gemini_3.0_Pro-4285F4?style=for-the-badge&logo=google)
![Voice Engine](https://img.shields.io/badge/Voice_Engine-Gemini_Voice-orange?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Live_&_Deployed-success?style=for-the-badge)

## 🚀 Links & Demo
- **🎥 3-Minute Demo Video:** [INSERT YOUR YOUTUBE/LOOM LINK HERE]
- **🔴 Live App:** [https://timedial-app-456115331802.us-central1.run.app](https://timedial-app-456115331802.us-central1.run.app)
- **📂 Devpost Submission:** [INSERT DEVPOST LINK HERE]

---

## 🏆 Hackathon Track Alignment
We are submitting **TimeDial** to the following tracks:

### 1. Google Cloud Track (Vertex AI)
* **Integration:** We utilize **Google Vertex AI** to access the exclusive **Gemini 3.0 Pro** model.
* **Why it matters:** Unlike standard chat apps, we leverage Gemini 3.0's superior **reasoning and roleplay capabilities** to maintain deep, historically accurate personas (Einstein, Cleopatra) that never break character, even when asked complex modern questions.
* **Infrastructure:** The entire application is containerized with **Docker** and deployed on **Google Cloud Run** for serverless scalability.

### 2. Gemini Multimodal Track (Voice Generation)
* **Integration:** We use the native audio generation capability of Gemini 3.1 Pro for ultra-low latency, natively integrated voice responses.
* **Voice-First Experience:** The app is designed as a "Voice-First" interface. We implemented a streaming architecture where Gemini generates audio responses natively, allowing users to have a fluid, natural conversation with history.
* **Emotional Range:** We utilized specific prompt and voice combinations to map characters to expressive Gemini voices.

---

## 💡 What it does
TimeDial is an educational time machine. Instead of reading boring textbooks, students can "dial in" a historical figure and have a real-time voice conversation.
* **Real-time Voice:** Speak to the app, and it speaks back instantly.
* **Visual Immersion:** The UI pulses and reacts to the character's voice frequency.
* **Fact-Checking:** Powered by Gemini's grounding to ensure historical accuracy.

## 🛠️ Tech Stack
* **AI Brain:** Google Vertex AI (Gemini 3.0 Pro)
* **Voice:** Gemini 3.1 Pro (Audio Modality)
* **Backend:** Python FastAPI (Async/Await)
* **Frontend:** HTML5, TailwindCSS, Vanilla JS
* **DevOps:** Docker, Google Cloud Run

## ⚙️ How to Run Locally
1. **Clone the repo:**
   ```bash
   git clone https://github.com/engrtitooo/TimeDial.git
   cd TimeDial
   ```

2. **Set up Environment Variables:**
Create a `.env` file with your keys:
```env
GOOGLE_API_KEY=your_api_key
PORT=8080
```

3. **Run with Docker:**
```bash
docker build -t timedial .
docker run -p 8080:8080 --env-file .env timedial
```

## 📜 License

MIT License - Open Source for the AI Partner Catalyst Hackathon.