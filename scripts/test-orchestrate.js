;(async () => {
  try {
    const gemini = await import('../lib/gemini.js').catch(async (e) => {
      // Try importing TS source if JS build not present
      return await import('../lib/gemini').catch(err => { throw err })
    })

    function greetText(role, resumeName) {
      const namestr = resumeName ? resumeName.split(' ')[0] : 'there'
      if (role === 'hr') return `Hello ${namestr}, I’m Mira Sharma from HR. In this round, we’ll focus on communication and workplace behaviour. Let’s begin.`
      if (role === 'technical') return `Hi ${namestr}, I’m Ashish Yadev, Domain Expert. I’ll evaluate your technical approach. Ready?`
      return `Good to meet you ${namestr}, I’m Ryan Bhardwaj, Hiring Manager. This round focuses on leadership and ownership.`
    }

    console.log('GREET test')
    console.log(greetText('hr', 'Test Candidate'))

    if (typeof gemini.generateInterviewQuestion === 'function') {
      console.log('\nQUESTION test')
      const q = await gemini.generateInterviewQuestion('technical', 'mid', 1, [], { experience: 'mid' })
      console.log(q)
    } else {
      console.log('generateInterviewQuestion not exported from lib/gemini')
    }

    if (typeof gemini.evaluateInterviewAnswer === 'function') {
      console.log('\nEVALUATE test')
      const e = await gemini.evaluateInterviewAnswer('Tell me about yourself', 'I am a software engineer', 'hr')
      console.log(JSON.stringify(e, null, 2))
    } else {
      console.log('evaluateInterviewAnswer not exported from lib/gemini')
    }
  } catch (err) {
    console.error('Test runner failed:', err)
    process.exit(1)
  }
})()
