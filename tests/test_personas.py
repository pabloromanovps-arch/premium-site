from conftest import SHOP

from salesai.llm.scripted import ScriptedLLM
from salesai.sim.personas import END_TOKEN, Persona, customer_message, load_personas

PERSONA = Persona(id="p", name="Ира", profile="34 года", goal="букет маме", behavior="вежливая", should_buy=True)


def test_load_30_personas_unique_ids():
    personas = load_personas(SHOP / "personas.json")
    assert len(personas) == 30
    assert len({p.id for p in personas}) == 30
    assert sum(p.should_buy for p in personas) == 20
    assert {p.id for p in personas if p.should_escalate} >= {"corporate_20", "complaint_wilted", "wants_human"}


def test_customer_uses_opening_without_llm():
    llm = ScriptedLLM([])
    p = PERSONA.model_copy(update={"opening": "Здравствуйте!"})
    assert customer_message(llm, p, "Лепесток", []) == "Здравствуйте!"
    assert llm.calls == []


def test_customer_roles_are_flipped():
    llm = ScriptedLLM(["Спасибо, беру [КОНЕЦ]"])
    history = [
        {"role": "user", "content": "Хочу букет"},
        {"role": "assistant", "content": "Есть «Нежность» за 4 590 ₽"},
    ]
    reply = customer_message(llm, PERSONA, "Лепесток", history)
    assert reply.endswith(END_TOKEN)
    sent = llm.calls[0]
    assert sent[0]["role"] == "system" and "букет маме" in sent[0]["content"] and END_TOKEN in sent[0]["content"]
    assert sent[1] == {"role": "assistant", "content": "Хочу букет"}
    assert sent[2] == {"role": "user", "content": "Есть «Нежность» за 4 590 ₽"}


def test_customer_first_message_without_opening():
    llm = ScriptedLLM(["Добрый день"])
    assert customer_message(llm, PERSONA, "Лепесток", []) == "Добрый день"
    assert llm.calls[0][-1]["role"] == "user"
