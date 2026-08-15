"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { addTodo, deleteTodo, setTodoDone } from "@/app/todos/actions";
import { PanelShell } from "./panel-shell";
import styles from "./board.module.css";

export interface BoardTodo {
  id: string;
  text: string;
  done: boolean;
}

interface TodosPanelProps extends HTMLAttributes<HTMLDivElement> {
  todos: BoardTodo[];
}

export const TodosPanel = forwardRef<HTMLDivElement, TodosPanelProps>(
  function TodosPanel({ todos, className, ...rest }, ref) {
    const addForm = useRef<HTMLFormElement>(null);
    const [items, setItems] = useState(todos);
    const [error, setError] = useState(false);
    const [isPending, startTransition] = useTransition();
    const openCount = items.filter((todo) => !todo.done).length;
    const completedCount = items.length - openCount;

    useEffect(() => setItems(todos), [todos]);

    function handleAdd(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const text = String(formData.get("text") ?? "").trim();
      if (!text) return;

      const temporaryId = `pending-${crypto.randomUUID()}`;
      setError(false);
      setItems((current) => [
        { id: temporaryId, text, done: false },
        ...current,
      ]);
      addForm.current?.reset();

      startTransition(async () => {
        try {
          const saved = await addTodo(formData);
          if (!saved) throw new Error("Todo was not saved");
          setItems((current) =>
            current.map((todo) => (todo.id === temporaryId ? saved : todo)),
          );
        } catch {
          setItems((current) =>
            current.filter((todo) => todo.id !== temporaryId),
          );
          setError(true);
        }
      });
    }

    function handleToggle(todo: BoardTodo) {
      const done = !todo.done;
      setError(false);
      setItems((current) =>
        current.map((item) => (item.id === todo.id ? { ...item, done } : item)),
      );
      startTransition(async () => {
        try {
          await setTodoDone(todo.id, done);
        } catch {
          setItems((current) =>
            current.map((item) =>
              item.id === todo.id ? { ...item, done: todo.done } : item,
            ),
          );
          setError(true);
        }
      });
    }

    function handleDelete(todo: BoardTodo) {
      const previousIndex = items.findIndex((item) => item.id === todo.id);
      setError(false);
      setItems((current) => current.filter((item) => item.id !== todo.id));
      startTransition(async () => {
        try {
          await deleteTodo(todo.id);
        } catch {
          setItems((current) => {
            const restored = [...current];
            restored.splice(previousIndex, 0, todo);
            return restored;
          });
          setError(true);
        }
      });
    }

    return (
      <PanelShell
        ref={ref}
        {...rest}
        className={`todos-panel${className ? ` ${className}` : ""}`}
        glyph="✓"
        eyebrow="Open checklist"
        title="Todos ✓"
        statValue={String(openCount)}
        statLabel={openCount === 1 ? "item" : "items"}
        afterStat={
          <form ref={addForm} onSubmit={handleAdd} className="panel-todo-add">
            <label htmlFor="board-new-todo" className={styles.visuallyHidden}>
              New todo
            </label>
            <input
              id="board-new-todo"
              name="text"
              type="text"
              required
              maxLength={500}
              autoComplete="off"
              placeholder="What needs doing?"
            />
            <button type="submit" className="ink-action">
              Add
            </button>
          </form>
        }
        footer={
          <p className={styles.meta}>
            {error
              ? "Action failed — rolled back"
              : isPending
                ? "Saving…"
                : `${completedCount} completed`}
          </p>
        }
        rows={
          items.length === 0 ? (
            <p className="panel-empty">Nothing to do.</p>
          ) : (
            items.map((todo) => (
              <div className="panel-row" key={todo.id}>
                <div>
                  <button
                    type="button"
                    onClick={() => handleToggle(todo)}
                    role="checkbox"
                    aria-checked={todo.done}
                    aria-label={todo.done ? `Reopen ${todo.text}` : `Complete ${todo.text}`}
                    className="panel-todo-check"
                    data-done={todo.done}
                  >
                    {todo.done ? "✓" : ""}
                  </button>
                </div>
                <p className="row-main" data-done={todo.done}>
                  {todo.text}
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => handleDelete(todo)}
                    aria-label={`Delete ${todo.text}`}
                    className="panel-todo-delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )
        }
      />
    );
  },
);
