import {useAgent} from "agents/react";
import {useAgentChat} from "agents/chat/react";
import type {SubmitEventHandler} from "react";

function App() {
  const agent = useAgent({ agent: 'ThinkAgent' })
  const { messages, sendMessage, clearHistory } = useAgentChat({ agent })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const text = String(new FormData(form).get('input') ?? '')

    if (!text) {
      return
    }

    await sendMessage({ text })
    form.reset()
  }

  return (
    <>
      <form onSubmit={onSubmit}>
        <input name="input" />
        <button type="submit">보내기</button>
        <button type="reset" onClick={clearHistory}>리셋</button>
      </form>
      <div>{JSON.stringify(messages)}</div>
    </>
  )
}

export default App
