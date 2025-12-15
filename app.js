// Vocabulary is loaded from vocab.js
const vocabulary = window.vocabulary;

class QuizApp {
    constructor() {
        this.currentDay = null;
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.totalQuestions = 0;
        this.synth = window.speechSynthesis;
        this.voices = [];
    }

    init() {
        // Expose app to global scope for HTML onclick handlers
        window.app = this;
        this.loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }

        this.checkBrowser();
    }

    checkBrowser() {
        const ua = navigator.userAgent.toLowerCase();
        // Detect KakaoTalk, Naver, Line, or generic WebViews
        const isInApp = ua.includes('kakaotalk') || ua.includes('naver') || ua.includes('line');

        if (isInApp) {
            const warningArea = document.getElementById('browser-warning-area') || document.querySelector('.sound-check-area');
            if (warningArea) {
                const msg = document.createElement('p');
                msg.style.cssText = "font-size: 0.8rem; color: #d32f2f; margin-top: 10px; word-break: keep-all;";
                msg.innerHTML = "지금 카톡으로 보고계시네요?<br>우측하단 <strong>점 세개</strong>를 눌러 <strong>'다른 브라우저로 열기'</strong>를 클릭하세요.";
                warningArea.appendChild(msg);
            }
        }
    }

    loadVoices() {
        const allVoices = this.synth.getVoices();
        const enUSVoices = allVoices.filter(v => v.lang === 'en-US');
        const koKRVoices = allVoices.filter(v => v.lang === 'ko-KR');

        // Prioritize English voices
        let preferredEnVoice = enUSVoices.find(v => v.name.includes("Google US English")) ||
            enUSVoices.find(v => v.name.includes("Samantha")) ||
            enUSVoices.find(v => v.name.includes("Microsoft")) ||
            enUSVoices[0]; // Fallback to first available en-US voice

        // Prioritize Korean voices
        let preferredKoVoice = koKRVoices.find(v => v.name.includes("Google 한국의")) ||
            koKRVoices[0]; // Fallback to first available ko-KR voice

        this.voices = [];
        if (preferredEnVoice) this.voices.push(preferredEnVoice);
        if (preferredKoVoice) this.voices.push(preferredKoVoice);
        // Add any other voices if needed, or just keep the preferred ones
        // For simplicity, we'll just store the preferred ones for now.
        // A more robust solution might store all and select dynamically in speak().
    }

    testAudio() {
        const btn = document.querySelector('.btn-secondary');
        const originalText = btn.innerText;
        btn.innerText = "🔊 Playing Both...";
        btn.disabled = true;

        // 1. Web Audio Beep (Immediate)
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                if (ctx.state === 'suspended') ctx.resume();

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start();
                gain.gain.setValueAtTime(0.5, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
                osc.stop(ctx.currentTime + 0.5);
            }
        } catch (e) { console.error(e); }

        // 2. TTS Voice (Immediate - CRITICAL for Mobile)
        // DO NOT use setTimeout here. It mostly breaks mobile TTS permission.
        this.synth.cancel();

        const u = new SpeechSynthesisUtterance("System audio check.");
        u.lang = 'en-US';
        u.rate = 1.0;
        u.volume = 1.0;

        u.onstart = () => {
            btn.innerText = "🗣️ Speaking...";
        };

        u.onend = () => {
            btn.innerText = originalText;
            btn.disabled = false;
        };

        u.onerror = (e) => {
            alert("TTS Error: " + e.error);
            btn.innerText = originalText;
            btn.disabled = false;
        };

        this.synth.speak(u);

        // Backup reset
        setTimeout(() => {
            if (btn.disabled) {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }, 4000);
    }

    startQuiz(day) {
        // Mobile Audio Unlock: Play a short audible word immediately on user gesture
        // Empty string might be ignored by some browsers optimization
        this.speak('Start', 'en-US');

        this.currentDay = day;
        const words = vocabulary[day];
        if (!words) {
            alert("Error: Vocabulary not found for this day.");
            return;
        }

        // Generate questions
        this.questions = this.generateQuestions(words, Object.values(vocabulary).flat());
        this.totalQuestions = this.questions.length;
        this.currentQuestionIndex = 0;
        this.score = 0;

        this.showScreen('quiz-screen');
        this.renderQuestion();
    }

    generateQuestions(targetWords, allWords) {
        // Create a pool of all meanings for distractors
        const allMeanings = allWords.map(w => w.meaning);

        const questions = targetWords.map(target => {
            // Filter out the correct meaning from distractors
            const distractors = allMeanings.filter(m => m !== target.meaning);
            // Shuffle and pick 3 distractors
            const selectedDistractors = this.shuffleArray(distractors).slice(0, 3);
            // Combine with correct answer
            const options = this.shuffleArray([target.meaning, ...selectedDistractors]);

            return {
                word: target.word,
                correctMeaning: target.meaning,
                options: options
            };
        });

        return this.shuffleArray(questions);
    }

    shuffleArray(array) {
        // Fisher-Yates shuffle
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    renderQuestion() {
        const question = this.questions[this.currentQuestionIndex];

        document.getElementById('day-label').innerText = this.currentDay;
        document.getElementById('question-counter').innerText = `${this.currentQuestionIndex + 1} / ${this.totalQuestions}`;
        document.getElementById('question-word').innerText = question.word;

        // Update Progress Bar
        const progress = ((this.currentQuestionIndex) / this.totalQuestions) * 100;
        document.getElementById('progress-bar').style.width = `${progress}%`;

        const optionsGrid = document.getElementById('options-grid');
        optionsGrid.innerHTML = '';

        question.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = option;
            btn.onclick = () => this.handleAnswer(btn, option, question.correctMeaning);
            optionsGrid.appendChild(btn);
        });

        // Auto-play English word (Safely moved to end)
        // Mobile browsers might block this if not directly user-triggered,
        // but 'startQuiz' unlock hack helps.
        setTimeout(() => {
            this.speakCurrentWord();
        }, 500);
    }

    handleAnswer(btn, selected, correct) {
        // Disable all buttons
        const buttons = document.querySelectorAll('.option-btn');
        buttons.forEach(b => b.disabled = true);

        if (selected === correct) {
            btn.classList.add('correct');
            this.score++;
            // Speak Korean meaning
            this.speak(correct, 'ko-KR');
        } else {
            btn.classList.add('wrong');
            // Highlight the correct one
            buttons.forEach(b => {
                if (b.innerText === correct) b.classList.add('correct');
            });
        }

        // Wait and go to next question
        setTimeout(() => {
            this.currentQuestionIndex++;
            if (this.currentQuestionIndex < this.totalQuestions) {
                this.renderQuestion();
            } else {
                this.finishQuiz();
            }
        }, 1500); // Increased delay slightly to read answer
    }

    finishQuiz() {
        this.showScreen('result-screen');
        const percentage = Math.round((this.score / this.totalQuestions) * 100);
        document.getElementById('final-score').innerText = this.score;

        let message = "";
        if (percentage === 100) {
            message = "Perfect! You are a genius! 🌟";
            this.fireConfetti();
        } else if (percentage >= 80) {
            message = "Great Job! Keep it up! 👍";
        } else if (percentage >= 50) {
            message = "Good try! Let's practice more! 💪";
        } else {
            message = "Don't give up! Try again! 🔥";
        }
        document.getElementById('result-message').innerText = message;
    }

    restart() {
        this.showScreen('start-screen');
        // Clear confetti if any
        document.getElementById('confetti-container').innerHTML = '';
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    fireConfetti() {
        const container = document.getElementById('confetti-container');
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];

        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.animationDelay = (Math.random() * 2) + 's';
            container.appendChild(confetti);
        }

        // Remove after animation
        setTimeout(() => {
            container.innerHTML = '';
        }, 5000);
    }

    speak(text, lang) {
        if (!this.synth) return; // Safety check

        try {
            this.synth.cancel(); // Always cancel previous

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = 0.8;

            // Voice Selection Logic
            if (this.voices.length > 0) {
                let preferredVoice = null;
                if (lang === 'en-US') {
                    // Start looking for high quality voices
                    preferredVoice = this.voices.find(v => v.name.includes("Google US English")) ||
                        this.voices.find(v => v.name.includes("Samantha")) ||
                        this.voices.find(v => v.lang === 'en-US');
                } else if (lang === 'ko-KR') {
                    preferredVoice = this.voices.find(v => v.lang === 'ko-KR');
                }

                if (preferredVoice) {
                    utterance.voice = preferredVoice;
                }
            }

            this.synth.speak(utterance);
        } catch (e) {
            console.error("Speech synthesis failed:", e);
        }
    }

    speakCurrentWord() {
        const question = this.questions[this.currentQuestionIndex];
        if (question) {
            this.speak(question.word, 'en-US');
        }
    }
}

const appInstance = new QuizApp();
appInstance.init();
