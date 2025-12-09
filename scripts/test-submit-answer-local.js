const { transcribeAudio, evaluateInterviewAnswer } = require('../lib/gemini')

async function run() {
  try {
    console.log('Testing transcribeAudio with dummy buffer...')
    const buf = Buffer.from('hello world')
    const text = await transcribeAudio(buf)
    console.log('Transcription result:', text)

    console.log('Testing evaluateInterviewAnswer with sample Q/A...')
    const evalRes = await evaluateInterviewAnswer('Tell me about yourself', 'I am a software engineer with 3 years experience', 'hr')
    console.log('Evaluation result:', evalRes)
  } catch (e) {
    console.error('Local test failed:', e)
  }
}

run()
