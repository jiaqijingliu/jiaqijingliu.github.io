(function () {
  var STORAGE_KEY = "todo-list-items";
  var THEME_KEY = "todo-theme";
  var PRIO_LABEL = { high: "高", medium: "中", low: "低" };
  var PRIO_ORDER = { high: 0, medium: 1, low: 2 };

  var listEl = document.getElementById("todo-list");
  var inputEl = document.getElementById("task-input");
  var addBtn = document.getElementById("add-btn");
  var prioritySelect = document.getElementById("priority-select");
  var tagInput = document.getElementById("tag-input");
  var dateInput = document.getElementById("date-input");
  var searchInput = document.getElementById("search-input");
  var sortSelect = document.getElementById("sort-select");
  var filterSelect = document.getElementById("filter");
  var themeSelect = document.getElementById("theme-select");
  var undoneCountEl = document.getElementById("undone-count");
  var doneCountEl = document.getElementById("done-count");
  var toolbarEl = document.getElementById("toolbar");
  var clearDoneBtn = document.getElementById("clear-done");
  var clearAllBtn = document.getElementById("clear-all");
  var clearAllCancelBtn = document.getElementById("clear-all-cancel");

  var todos = loadTodos();
  var editingId = null;
  var completedCollapsed = false;
  var searchQuery = "";
  var sortMode = "default";
  var draggedId = null;

  var confirmingClearAll = false;
  var clearAllTimer = null;

  function genId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function todayStr() {
    var d = new Date();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function tomorrowStr() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + m + "-" + day;
  }

  // 读取本地存储，并兼容旧数据（补齐缺失字段）
  function loadTodos() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(function (t) {
          return {
            id: t.id || genId(),
            text: t.text != null ? t.text : "",
            done: !!t.done,
            priority: t.priority || "medium",
            tag: t.tag || "",
            due: t.due || ""
          };
        })
        .filter(function (t) { return t.text !== ""; });
    } catch (e) {
      return [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      /* 存储不可用时静默忽略 */
    }
  }

  function findTodo(id) {
    for (var i = 0; i < todos.length; i++) {
      if (todos[i].id === id) return todos[i];
    }
    return null;
  }

  // 对某一组（未完成 / 已完成）按当前排序方式排序
  function sortGroup(items) {
    if (sortMode === "priority") {
      return items.slice().sort(function (a, b) {
        return (PRIO_ORDER[a.priority] != null ? PRIO_ORDER[a.priority] : 2) -
               (PRIO_ORDER[b.priority] != null ? PRIO_ORDER[b.priority] : 2);
      });
    }
    if (sortMode === "due") {
      return items.slice().sort(function (a, b) {
        var da = a.due || "9999-99-99";
        var db = b.due || "9999-99-99";
        return da < db ? -1 : da > db ? 1 : 0;
      });
    }
    return items; // 默认：保持手动/添加顺序
  }

  // 搜索 + 分组 + 排序，返回 { active, done }
  function getVisibleTodos() {
    var q = searchQuery;
    var matched = todos.filter(function (t) {
      if (!q) return true;
      if (t.text.toLowerCase().indexOf(q) !== -1) return true;
      return t.tag && t.tag.toLowerCase().indexOf(q) !== -1;
    });
    return {
      active: sortGroup(matched.filter(function (t) { return !t.done; })),
      done: sortGroup(matched.filter(function (t) { return t.done; }))
    };
  }

  function render() {
    listEl.innerHTML = "";

    var doneCount = 0;
    todos.forEach(function (t) { if (t.done) doneCount++; });
    var undoneCount = todos.length - doneCount;

    undoneCountEl.textContent = undoneCount;
    doneCountEl.textContent = doneCount;

    clearDoneBtn.disabled = doneCount === 0;
    clearAllBtn.disabled = todos.length === 0;
    if (todos.length === 0) resetClearAllConfirm();

    if (todos.length === 0) {
      toolbarEl.style.display = "none";
      listEl.appendChild(renderEmpty("🌸", "暂无待办任务", "输入内容，添加第一个任务吧～"));
      return;
    }

    toolbarEl.style.display = "flex";

    var visible = getVisibleTodos();
    var activeItems = visible.active;
    var doneItems = visible.done;
    var hasQuery = searchQuery !== "";
    var filter = filterSelect.value;

    if (filter === "active") {
      if (activeItems.length === 0) {
        if (hasQuery) listEl.appendChild(renderEmpty("🔍", "没有匹配的未完成任务", "换个关键词试试"));
        else listEl.appendChild(renderEmpty("🎉", "全部完成啦！", "太棒了，所有任务都已完成"));
        return;
      }
      activeItems.forEach(function (t) { listEl.appendChild(createTodoEl(t)); });
    } else if (filter === "done") {
      if (doneItems.length === 0) {
        listEl.appendChild(renderEmpty("📭", "还没有已完成的任务", "完成任务后，会显示在这里"));
        return;
      }
      doneItems.forEach(function (t) { listEl.appendChild(createTodoEl(t)); });
    } else {
      if (activeItems.length === 0 && doneItems.length === 0) {
        listEl.appendChild(renderEmpty("🔍", "没有找到匹配的任务", "换个关键词试试"));
        return;
      }
      activeItems.forEach(function (t) { listEl.appendChild(createTodoEl(t)); });
      if (doneItems.length > 0) {
        listEl.appendChild(createDoneHeader(doneItems.length));
        if (!completedCollapsed) {
          doneItems.forEach(function (t) { listEl.appendChild(createTodoEl(t)); });
        }
      }
    }
  }

  function renderEmpty(emoji, title, subtitle) {
    var li = document.createElement("li");
    li.className = "list__empty";

    var e = document.createElement("div");
    e.className = "list__empty-emoji";
    e.textContent = emoji;

    var t = document.createElement("div");
    t.className = "list__empty-title";
    t.textContent = title;

    var s = document.createElement("div");
    s.className = "list__empty-sub";
    s.textContent = subtitle;

    li.appendChild(e);
    li.appendChild(t);
    li.appendChild(s);
    return li;
  }

  function createDoneHeader(count) {
    var li = document.createElement("li");
    li.className = "group-header";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-header__btn";
    btn.addEventListener("click", function () {
      completedCollapsed = !completedCollapsed;
      render();
    });

    var label = document.createElement("span");
    label.className = "group-header__label";
    label.appendChild(document.createTextNode("已完成 "));
    var b = document.createElement("b");
    b.textContent = count;
    label.appendChild(b);

    var chevron = document.createElement("span");
    chevron.className = "group-header__chevron";
    chevron.textContent = completedCollapsed ? "▸" : "▾";

    btn.appendChild(label);
    btn.appendChild(chevron);
    li.appendChild(btn);
    return li;
  }

  function isOverdue(due) {
    return !!due && due < todayStr();
  }

  function formatDue(due, overdue) {
    if (due === todayStr()) return "今天";
    if (due === tomorrowStr()) return "明天";
    var parts = due.split("-");
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    var label = m + "/" + d;
    return overdue ? "已过期 " + label : label;
  }

  function createTagChip(tag) {
    var c = document.createElement("span");
    c.className = "tag-chip";
    c.textContent = tag;
    c.title = "点击筛选该标签";
    c.addEventListener("click", function () {
      searchInput.value = tag;
      searchQuery = tag.toLowerCase();
      render();
      searchInput.focus();
    });
    return c;
  }

  function createDueChip(due, done) {
    var overdue = !done && isOverdue(due);
    var c = document.createElement("span");
    c.className = "due-chip" + (overdue ? " due-chip--overdue" : "");
    c.textContent = formatDue(due, overdue);
    c.title = "截止日期";
    return c;
  }

  function createTodoEl(todo) {
    if (editingId === todo.id) return createEditEl(todo);

    var li = document.createElement("li");
    li.className = "todo" + (todo.done ? " todo--done" : "");
    li.dataset.priority = todo.priority;

    var draggable = sortMode === "default" && !todo.done;
    if (draggable) {
      li.draggable = true;
      li.classList.add("todo--draggable");
      li.addEventListener("dragstart", function (e) {
        draggedId = todo.id;
        e.dataTransfer.effectAllowed = "move";
        li.classList.add("todo--dragging");
      });
      li.addEventListener("dragend", function () {
        li.classList.remove("todo--dragging");
        draggedId = null;
      });
      li.addEventListener("dragover", function (e) {
        if (draggedId) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      });
      li.addEventListener("drop", function (e) {
        e.preventDefault();
        if (draggedId && draggedId !== todo.id) reorderTodo(draggedId, todo.id);
      });
    }

    if (draggable) {
      var handle = document.createElement("span");
      handle.className = "todo__handle";
      handle.textContent = "⠿";
      handle.title = "拖拽排序";
      li.appendChild(handle);
    }

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "todo__toggle";
    toggle.setAttribute("aria-label", todo.done ? "标记为未完成" : "标记为完成");
    toggle.addEventListener("click", function () { toggleDone(todo.id); });

    var badge = document.createElement("span");
    badge.className = "prio-badge prio-badge--" + todo.priority;
    badge.textContent = PRIO_LABEL[todo.priority];

    var text = document.createElement("span");
    text.className = "todo__text";
    text.textContent = todo.text;

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "todo__edit";
    editBtn.textContent = "✎";
    editBtn.setAttribute("aria-label", "编辑任务");
    editBtn.setAttribute("title", "编辑");
    editBtn.addEventListener("click", function () { startEdit(todo.id); });

    var del = document.createElement("button");
    del.type = "button";
    del.className = "todo__delete";
    del.textContent = "×";
    del.setAttribute("aria-label", "删除任务");
    del.setAttribute("title", "删除");
    del.addEventListener("click", function () { deleteTodo(todo.id); });

    li.appendChild(toggle);
    li.appendChild(badge);
    li.appendChild(text);
    if (todo.tag) li.appendChild(createTagChip(todo.tag));
    if (todo.due) li.appendChild(createDueChip(todo.due, todo.done));
    li.appendChild(editBtn);
    li.appendChild(del);
    return li;
  }

  function createEditEl(todo) {
    var li = document.createElement("li");
    li.className = "todo todo--editing";

    var row1 = document.createElement("div");
    row1.className = "edit__row";
    var input = document.createElement("input");
    input.type = "text";
    input.id = "edit-input";
    input.className = "edit__input";
    input.value = todo.text;
    input.maxLength = 200;
    row1.appendChild(input);

    var row2 = document.createElement("div");
    row2.className = "edit__row";

    var sel = document.createElement("select");
    sel.id = "edit-priority";
    sel.className = "edit__priority";
    ["high", "medium", "low"].forEach(function (p) {
      var o = document.createElement("option");
      o.value = p;
      o.textContent = PRIO_LABEL[p];
      if (p === todo.priority) o.selected = true;
      sel.appendChild(o);
    });

    var tagEdit = document.createElement("input");
    tagEdit.type = "text";
    tagEdit.id = "edit-tag";
    tagEdit.className = "edit__meta";
    tagEdit.value = todo.tag;
    tagEdit.placeholder = "标签";
    tagEdit.maxLength = 20;
    tagEdit.setAttribute("list", "tag-list");

    var dateEdit = document.createElement("input");
    dateEdit.type = "date";
    dateEdit.id = "edit-due";
    dateEdit.className = "edit__meta";
    dateEdit.value = todo.due;

    var save = document.createElement("button");
    save.type = "button";
    save.className = "btn btn--mini btn--save";
    save.textContent = "保存";
    save.addEventListener("click", function () { saveEdit(todo.id); });

    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn--mini btn--cancel";
    cancel.textContent = "取消";
    cancel.addEventListener("click", function () { cancelEdit(); });

    row2.appendChild(sel);
    row2.appendChild(tagEdit);
    row2.appendChild(dateEdit);
    row2.appendChild(save);
    row2.appendChild(cancel);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); saveEdit(todo.id); }
      else if (e.key === "Escape") { cancelEdit(); }
    });

    li.appendChild(row1);
    li.appendChild(row2);
    return li;
  }

  function reorderTodo(fromId, toId) {
    var active = todos.filter(function (t) { return !t.done; });
    var fromIdx = -1, toIdx = -1;
    for (var i = 0; i < active.length; i++) {
      if (active[i].id === fromId) fromIdx = i;
      if (active[i].id === toId) toIdx = i;
    }
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    var moved = active.splice(fromIdx, 1)[0];
    active.splice(toIdx, 0, moved);
    var done = todos.filter(function (t) { return t.done; });
    todos = active.concat(done);
    render();
    saveTodos();
  }

  function toggleDone(id) {
    var todo = findTodo(id);
    if (todo) todo.done = !todo.done;
    render();
    saveTodos();
  }

  function deleteTodo(id) {
    todos = todos.filter(function (t) { return t.id !== id; });
    if (editingId === id) editingId = null;
    render();
    saveTodos();
  }

  function startEdit(id) {
    editingId = id;
    render();
    var input = document.getElementById("edit-input");
    if (input) { input.focus(); input.select(); }
  }

  function saveEdit(id) {
    var input = document.getElementById("edit-input");
    var sel = document.getElementById("edit-priority");
    var tagEdit = document.getElementById("edit-tag");
    var dateEdit = document.getElementById("edit-due");
    if (!input || !sel) return;

    var text = input.value.trim();
    if (!text) { input.focus(); return; }

    var todo = findTodo(id);
    if (todo) {
      todo.text = text;
      todo.priority = sel.value;
      todo.tag = tagEdit ? tagEdit.value.trim() : "";
      todo.due = dateEdit ? dateEdit.value : "";
    }
    editingId = null;
    render();
    saveTodos();
  }

  function cancelEdit() {
    editingId = null;
    render();
  }

  function addTodo() {
    var text = inputEl.value.trim();
    if (!text) { inputEl.focus(); return; }
    todos.push({
      id: genId(),
      text: text,
      done: false,
      priority: prioritySelect.value,
      tag: tagInput.value.trim(),
      due: dateInput.value
    });
    render();
    saveTodos();
    inputEl.value = "";
    tagInput.value = "";
    dateInput.value = "";
    inputEl.focus();
  }

  function resetClearAllConfirm() {
    confirmingClearAll = false;
    if (clearAllTimer) { clearTimeout(clearAllTimer); clearAllTimer = null; }
    clearAllBtn.textContent = "全部清空";
    clearAllBtn.classList.remove("btn--confirm");
    clearAllCancelBtn.hidden = true;
    clearDoneBtn.hidden = false;
  }

  function applyTheme(theme) {
    document.body.classList.remove("theme-pink", "theme-dark");
    if (theme === "pink") document.body.classList.add("theme-pink");
    else if (theme === "dark") document.body.classList.add("theme-dark");
  }

  addBtn.addEventListener("click", addTodo);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); addTodo(); }
    else if (e.key === "Escape") { inputEl.value = ""; }
  });

  // 快捷键："/" 聚焦搜索框
  document.addEventListener("keydown", function (e) {
    var el = document.activeElement;
    var typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
    if (e.key === "/" && !typing) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  prioritySelect.addEventListener("change", function () {
    prioritySelect.dataset.priority = prioritySelect.value;
  });
  filterSelect.addEventListener("change", function () { render(); });
  sortSelect.addEventListener("change", function () {
    sortMode = sortSelect.value;
    render();
  });
  searchInput.addEventListener("input", function () {
    searchQuery = searchInput.value.trim().toLowerCase();
    render();
  });
  themeSelect.addEventListener("change", function () {
    applyTheme(themeSelect.value);
    try { localStorage.setItem(THEME_KEY, themeSelect.value); } catch (e) {}
  });

  clearDoneBtn.addEventListener("click", function () {
    todos = todos.filter(function (t) { return !t.done; });
    if (editingId && !findTodo(editingId)) editingId = null;
    render();
    saveTodos();
  });

  clearAllBtn.addEventListener("click", function () {
    if (!confirmingClearAll) {
      if (todos.length === 0) return;
      confirmingClearAll = true;
      clearAllBtn.textContent = "确认清空全部？";
      clearAllBtn.classList.add("btn--confirm");
      clearAllCancelBtn.hidden = false;
      clearDoneBtn.hidden = true;
      clearAllTimer = setTimeout(resetClearAllConfirm, 4000);
    } else {
      todos = [];
      editingId = null;
      render();
      saveTodos();
      resetClearAllConfirm();
    }
  });

  clearAllCancelBtn.addEventListener("click", resetClearAllConfirm);

  // 初始化主题
  var savedTheme = "default";
  try { savedTheme = localStorage.getItem(THEME_KEY) || "default"; } catch (e) {}
  if (savedTheme !== "default" && savedTheme !== "pink" && savedTheme !== "dark") savedTheme = "default";
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);

  render();
})();
