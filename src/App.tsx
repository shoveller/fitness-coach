import { useAgent } from 'agents/react'
import { useAgentChat } from '@cloudflare/think/react'
import { isToolUIPart, getToolName } from 'ai'
import { useState, type SubmitEventHandler } from 'react'

type WorkspaceState = {
  files: { path: string; type: 'file' | 'directory' | 'symlink'; size: number }[]
}

function App() {
  const agent = useAgent<WorkspaceState>({ agent: 'ThinkAgent' })
  const { messages, sendMessage, clearHistory, status, isStreaming, isRecovering, error } = useAgentChat({ agent })
  const [input, setInput] = useState('')
  const [actionError, setActionError] = useState('')
  const [file, setFile] = useState<{ path: string; content: string } | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const busy = status === 'submitted' || isStreaming || isRecovering
  const errorMessage = actionError || error?.message || agent.connectionError?.message

  const onSubmit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    const text = input.trim()

    if (!text || busy) {
      return
    }

    setActionError('')
    setInput('')

    try {
      await sendMessage({ text })
    } catch (error) {
      setInput(text)
      setActionError(error instanceof Error ? error.message : '메시지를 보내지 못했습니다.')
    }
  }

  const readFile = async (path: string) => {
    setReadingFile(true)
    setFile(null)
    setActionError('')

    try {
      const content = await agent.call<string | null>('readWorkspaceFile', [path])
      setFile({ path, content: content ?? '파일을 찾을 수 없습니다.' })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '파일을 읽지 못했습니다.')
    } finally {
      setReadingFile(false)
    }
  }

  return (
    <main style={{ padding: 24, textAlign: 'left', overflowWrap: 'anywhere' }}>
      <h1>ThinkAgent</h1>
      <p>날씨를 묻거나 워크스페이스에 파일을 작성하도록 요청하세요.</p>
      <section aria-label="대화" aria-busy={busy}>
        {messages.map((message) => (
          <article key={message.id} style={{ marginBlock: 16 }}>
            <strong>{message.role === 'user' ? '나' : '에이전트'}</strong>
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return <p key={index} style={{ whiteSpace: 'pre-wrap' }}>{part.text}</p>
              }

              if (isToolUIPart(part)) {
                return (
                  <details key={part.toolCallId}>
                    <summary>도구: {getToolName(part)} · {part.state}</summary>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(part, null, 2)}</pre>
                  </details>
                )
              }

              return null
            })}
          </article>
        ))}
      </section>
      <form onSubmit={onSubmit}>
        <label htmlFor="input">메시지</label>
        <textarea
          id="input"
          name="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="서울 날씨를 알려주고 weather.txt에 저장해줘"
          rows={3}
          required
          disabled={busy}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
        />
        <button type="submit" disabled={busy || !input.trim()}>보내기</button>
        <button type="button" onClick={clearHistory} disabled={busy}>대화 지우기</button>
      </form>
      <p role="status">{isRecovering ? '응답 복구 중…' : busy ? '응답 중…' : ''}</p>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      <section aria-labelledby="files-heading" style={{ marginTop: 24 }}>
        <h2 id="files-heading">워크스페이스 파일</h2>
        {!agent.state ? <p>파일 목록 불러오는 중…</p> : agent.state.files.length === 0 ? <p>파일이 없습니다.</p> : (
          <ul>
            {agent.state.files.map((entry) => (
              <li key={entry.path}>
                {entry.type === 'directory' ? `${entry.path}/` : (
                  <button type="button" disabled={readingFile} onClick={() => readFile(entry.path)}>
                    {entry.path} ({entry.size} bytes)
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {readingFile && <p role="status">파일 읽는 중…</p>}
        {file && (
          <div>
            <h3>{file.path}</h3>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{file.content}</pre>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
