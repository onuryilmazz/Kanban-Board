/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Type } from 'https://esm.sh/@google/genai@^0.14.0';

// Safely access the API key, will be undefined in browser environments without a build step
const API_KEY = typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;

// --- STATE ---
let columns = [];
let draggedItem = null; // Can be { type: 'card', ... } or { type: 'column', ... }
let userData = {
    name: 'Guest',
    avatar: null, // base64 string
    theme: 'Default'
};

// --- CONFIG ---
const THEMES = {
    'Default': [
        { main: '#4A90E2', bg: '#F0F5FF' }, // Blue
        { main: '#F5A623', bg: '#FFF9F0' }, // Orange
        { main: '#BD10E0', bg: '#FBF0FF' }, // Purple
        { main: '#7ED321', bg: '#F7FFF0' }, // Green
        { main: '#50E3C2', bg: '#F0FFFB' }, // Teal
    ],
    'Bolivia': [
        { main: '#d92323', bg: '#ffebeb' }, // Red
        { main: '#ffce00', bg: '#fff9e0' }, // Yellow
        { main: '#007a3d', bg: '#e0f2e7' }, // Green
        { main: '#ff8c00', bg: '#fff3e0' }, // Dark Orange
        { main: '#c62828', bg: '#ffcdd2' }, // Darker Red
    ],
    'France': [
        { main: '#0055a4', bg: '#e0e9f2' }, // Blue
        { main: '#ef4135', bg: '#fde8e6' }, // Red
        { main: '#808080', bg: '#f2f2f2' }, // Grey
        { main: '#0078d7', bg: '#e1f5fe' }, // Light Blue
        { main: '#c62828', bg: '#ffcdd2' }, // Darker Red
    ],
    'Netherlands': [
        { main: '#ae1c28', bg: '#f9e4e6' }, // Red
        { main: '#21468b', bg: '#e2e8f3' }, // Blue
        { main: '#808080', bg: '#f2f2f2' }, // Grey
        { main: '#ff7f00', bg: '#fff2e5' }, // Orange
        { main: '#003366', bg: '#e0e6ec' }, // Dark Blue
    ],
    'Turkey': [
        { main: '#e30a17', bg: '#fce4e6' }, // Red
        { main: '#9e1b22', bg: '#f4e8e9' }, // Dark Red
        { main: '#808080', bg: '#f2f2f2' }, // Grey
        { main: '#b71c1c', bg: '#ffcdd2' }, // Another Red
        { main: '#d50000', bg: '#ff8a80' }, // Bright Red
    ],
};
let COLOR_PALETTE = THEMES['Default'];


// --- DOM ELEMENTS ---
const appContainer = document.getElementById('app-container');

// --- HELPER FUNCTIONS ---
const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// --- AI FUN FACT ---
const fetchAndDisplayFunFact = async (themeName) => {
    const funFactContainer = document.querySelector('.fun-fact-container');
    if (!funFactContainer) return;

    if (!API_KEY) {
        funFactContainer.style.display = 'none';
        return;
    }
    
    funFactContainer.style.display = 'flex';
    const funFactEl = funFactContainer.querySelector('.fun-fact-content');
    if (!funFactEl) return;


    funFactEl.textContent = 'Loading...';
    funFactEl.title = '';

    try {
        const ai = new GoogleGenAI({apiKey: API_KEY});
        const prompt = themeName === 'Default'
            ? 'Tell me a very short, concise, and funny fun fact about productivity or Kanban boards. Keep it to one sentence.'
            : `Tell me a very short, concise, and funny fun fact about the country ${themeName}. Keep it to one sentence.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const fact = response.text.trim();
        funFactEl.textContent = fact;
        funFactEl.title = fact; // Add tooltip for long facts
    } catch (error) {
        console.error('Failed to fetch fun fact:', error);
        funFactEl.textContent = 'Could not load a fun fact right now!';
    }
};

// --- USER DATA & THEME ---
const saveUserData = () => {
    try {
        localStorage.setItem('kanbanUserData', JSON.stringify(userData));
    } catch (error) {
        console.error("Could not save user data to localStorage:", error);
    }
};

const loadUserData = () => {
    try {
        const savedData = localStorage.getItem('kanbanUserData');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            userData = { ...userData, ...parsedData };
        }
    } catch (error) {
        console.error("Could not load user data from localStorage:", error);
    }
};

const applyTheme = (themeName) => {
    if (THEMES[themeName]) {
        userData.theme = themeName;
        COLOR_PALETTE = THEMES[themeName];
        columns.forEach((col, index) => {
            col.color = COLOR_PALETTE[index % COLOR_PALETTE.length];
        });
        saveUserData();
        renderApp();
        fetchAndDisplayFunFact(themeName);
    }
};


// --- DRAG & DROP HANDLERS ---
const handleDragStart = (e, item) => {
  draggedItem = item;
  e.dataTransfer.effectAllowed = 'move';
  
  let className = '';
  if (item.type === 'card') {
    className = 'dragging';
    e.dataTransfer.setData('text/plain', 'card'); // Necessary for Firefox
  } else if (item.type === 'column') {
    className = 'column--dragging';
    e.dataTransfer.setData('text/plain', 'column'); // Necessary for Firefox
  }
  
  if (className) {
    setTimeout(() => e.target.classList.add(className), 0);
  }
};

const handleDragEnd = (e) => {
  if (!draggedItem) return;

  let className = '';
  if (draggedItem.type === 'card') {
    className = 'dragging';
  } else if (draggedItem.type === 'column') {
    className = 'column--dragging';
  }
  
  if (className && e.target) {
    e.target.classList.remove(className);
  }
  
  document.querySelectorAll('.column.drag-over').forEach(col => col.classList.remove('drag-over'));
  draggedItem = null;
};

const handleCardDrop = (toColIndex, toCardIndex) => {
  if (!draggedItem || draggedItem.type !== 'card') return;

  const { fromColIndex, fromCardIndex } = draggedItem;
  if (fromColIndex === toColIndex && fromCardIndex === toCardIndex) return;

  const cardToMove = columns[fromColIndex].cards.splice(fromCardIndex, 1)[0];
  if (!cardToMove) return;

  columns[toColIndex].cards.splice(toCardIndex, 0, cardToMove);
  renderApp();
};

const handleColumnDrop = (e, toIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.type !== 'column') return;
    
    const { fromIndex } = draggedItem;
    if (fromIndex === toIndex) return;

    const [movedColumn] = columns.splice(fromIndex, 1);
    columns.splice(toIndex, 0, movedColumn);
    renderApp();
};


// --- MODALS & CONFIRMATION ---
const createConfirmModal = ({ message, confirmText, onConfirm }) => {
  // Close any other open modals first to prevent stacking
  const existingModals = document.querySelectorAll('.modal-overlay');
  existingModals.forEach(modal => modal.remove());

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const closeModal = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  const modal = document.createElement('div');
  modal.className = 'modal-content';
  modal.style.maxWidth = '450px';

  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';
  modalBody.textContent = message;
  modalBody.style.padding = '16px 0';

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'add-btn';
  cancelButton.textContent = 'Cancel';
  cancelButton.style.backgroundColor = '#dfe1e6';
  cancelButton.style.color = '#172b4d';
  cancelButton.addEventListener('click', closeModal);

  const confirmButton = document.createElement('button');
  confirmButton.className = 'add-btn';
  confirmButton.textContent = confirmText;
  confirmButton.style.backgroundColor = '#bf2600'; // Danger color
  confirmButton.addEventListener('click', () => {
    onConfirm();
    closeModal();
  });

  footer.append(cancelButton, confirmButton);
  modal.append(modalBody, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  confirmButton.focus();
};

const closeCardDetailModal = () => {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.remove();
  }
};

const createCardDetailModal = (columnIndex, cardIndex) => {
  closeCardDetailModal();

  const card = columns[columnIndex].cards[cardIndex];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeCardDetailModal();
    }
  });

  const modal = document.createElement('div');
  modal.className = 'modal-content';

  const closeButton = document.createElement('button');
  closeButton.className = 'close-btn';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.onclick = closeCardDetailModal;
  
  const body = document.createElement('div');
  body.className = 'modal-body';

  // --- Title Group ---
  const titleGroup = document.createElement('div');
  titleGroup.className = 'form-group';
  const titleLabel = document.createElement('label');
  titleLabel.htmlFor = 'modalTitleInput';
  titleLabel.textContent = 'Title';
  const titleWrapper = document.createElement('div');
  titleWrapper.className = 'input-wrapper';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'modalTitleInput';
  titleInput.value = card.text;
  titleInput.className = 'modal-title-input';
  titleInput.placeholder = 'e.g. Design database schema';
  titleInput.maxLength = 100;
  const titleClearBtn = document.createElement('button');
  titleClearBtn.type = 'button';
  titleClearBtn.className = 'input-clear-btn';
  titleClearBtn.innerHTML = '&times;';
  titleClearBtn.setAttribute('aria-label', 'Clear title');
  titleClearBtn.onclick = () => {
      titleInput.value = '';
      titleInput.focus();
      titleClearBtn.style.display = 'none';
  };
  titleInput.addEventListener('input', () => {
    titleClearBtn.style.display = titleInput.value ? 'flex' : 'none';
  });
  // Initial state for clear button
  titleClearBtn.style.display = titleInput.value ? 'flex' : 'none';

  titleWrapper.append(titleInput, titleClearBtn);
  titleGroup.append(titleLabel, titleWrapper);
  
  // --- Description Group ---
  const descGroup = document.createElement('div');
  descGroup.className = 'form-group';
  const descriptionLabel = document.createElement('label');
  descriptionLabel.htmlFor = 'modalDescription';
  descriptionLabel.textContent = 'Description';
  const descriptionTextarea = document.createElement('textarea');
  descriptionTextarea.id = 'modalDescription';
  descriptionTextarea.placeholder = 'Add a more detailed description...';
  descriptionTextarea.value = card.description || '';
  descriptionTextarea.maxLength = 250;
  descGroup.append(descriptionLabel, descriptionTextarea);

  // --- Due Date Group ---
  const dateGroup = document.createElement('div');
  dateGroup.className = 'form-group';
  const dueDateLabel = document.createElement('label');
  dueDateLabel.htmlFor = 'modalDueDate';
  dueDateLabel.textContent = 'Due Date';
  const dateWrapper = document.createElement('div');
  dateWrapper.className = 'date-input-wrapper';
  const dueDateInput = document.createElement('input');
  dueDateInput.type = 'date';
  dueDateInput.id = 'modalDueDate';
  dueDateInput.value = card.dueDate || '';
  const calendarIcon = document.createElement('span');
  calendarIcon.className = 'calendar-icon';
  calendarIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89,3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z"/></svg>`;
  dateWrapper.append(dueDateInput, calendarIcon);
  dateGroup.append(dueDateLabel, dateWrapper);

  body.append(titleGroup, descGroup, dateGroup);

  // --- Footer ---
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const saveButton = document.createElement('button');
  saveButton.className = 'add-btn';
  saveButton.textContent = 'Save';
  saveButton.addEventListener('click', () => {
    columns[columnIndex].cards[cardIndex] = {
      ...card,
      text: titleInput.value.trim(),
      description: descriptionTextarea.value.trim(),
      dueDate: dueDateInput.value,
    };
    renderApp();
    closeCardDetailModal();
  });

  footer.appendChild(saveButton);
  modal.append(closeButton, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  titleInput.focus();
};

const createAddListModal = () => {
    // Close any other open modals first to prevent stacking
    const existingModals = document.querySelectorAll('.modal-overlay');
    existingModals.forEach(modal => modal.remove());
  
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const closeModal = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.maxWidth = '480px';
  
    const closeButton = document.createElement('button');
    closeButton.className = 'close-btn';
    closeButton.innerHTML = '&times;';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.onclick = closeModal;
  
    const body = document.createElement('div');
    body.className = 'modal-body';
  
    const form = document.createElement('form');
  
    const titleGroup = document.createElement('div');
    titleGroup.className = 'form-group';
    const titleLabel = document.createElement('label');
    titleLabel.htmlFor = 'listTitleInput';
    titleLabel.textContent = 'List Title';

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'input-wrapper';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.id = 'listTitleInput';
    titleInput.className = 'modal-title-input';
    titleInput.placeholder = 'e.g., Blockers';
    titleInput.maxLength = 50;
    
    titleWrapper.appendChild(titleInput);
    titleGroup.append(titleLabel, titleWrapper);
    form.appendChild(titleGroup);
    
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const addButton = document.createElement('button');
    addButton.type = 'submit';
    addButton.className = 'add-btn';
    addButton.textContent = 'Add List';
    footer.appendChild(addButton);
    form.appendChild(footer);
  
    const handleAddList = (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (title) {
          const newColumn = {
              id: generateId(),
              title,
              cards: [],
              color: COLOR_PALETTE[columns.length % COLOR_PALETTE.length],
          };
          columns.push(newColumn);
          renderApp();
          // Scroll to the new column after rendering
          setTimeout(() => {
              const board = document.querySelector('.board');
              if(board) {
                  board.scrollLeft = board.scrollWidth;
              }
          }, 0);
          closeModal();
      }
    };
  
    form.addEventListener('submit', handleAddList);
  
    body.appendChild(form);
    modal.append(closeButton, body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    titleInput.focus();
};

// --- DOM CREATION FUNCTIONS ---
const createAddItemForm = ({ onAdd, onCancel, placeholder, ctaText, maxLength }) => {
  const form = document.createElement('form');
  form.className = 'add-form';

  const textarea = document.createElement('textarea');
  textarea.className = 'add-input';
  textarea.placeholder = placeholder;
  if (maxLength) {
    textarea.maxLength = maxLength;
  }

  const controls = document.createElement('div');
  controls.className = 'add-controls';

  const addButton = document.createElement('button');
  addButton.type = 'submit';
  addButton.className = 'add-btn';
  addButton.textContent = ctaText;

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'cancel-btn';
  cancelButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" /></svg>`;
  cancelButton.setAttribute('aria-label', 'Cancel');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (textarea.value.trim()) {
      onAdd(textarea.value.trim());
    }
  });

  cancelButton.addEventListener('click', onCancel);

  controls.append(addButton, cancelButton);
  form.append(textarea, controls);

  setTimeout(() => textarea.focus(), 0);

  return form;
};


const createCardElement = (card, columnIndex, cardIndex, columnId) => {
  const cardEl = document.createElement('div');
  cardEl.className = 'card';
  cardEl.draggable = true;
  cardEl.setAttribute('role', 'listitem');

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'card-content';

  const cardTitle = document.createElement('h3');
  cardTitle.className = 'card-title';
  cardTitle.textContent = card.text;
  contentWrapper.appendChild(cardTitle);
  
  if (card.description) {
    const cardDescription = document.createElement('p');
    cardDescription.className = 'card-description';
    cardDescription.textContent = card.description;
    contentWrapper.appendChild(cardDescription);
  }
  
  const cardActions = document.createElement('div');
  cardActions.className = 'card-actions';

  const editButton = document.createElement('button');
  editButton.className = 'card-action-btn edit-card-btn';
  editButton.setAttribute('aria-label', 'Edit card');
  editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"></path></svg>`;
  editButton.addEventListener('click', (e) => {
    e.stopPropagation();
    createCardDetailModal(columnIndex, cardIndex);
  });

  const deleteButton = document.createElement('button');
  deleteButton.className = 'card-action-btn delete-card-btn';
  deleteButton.setAttribute('aria-label', 'Delete card');
  deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9,3V4H4V6H5V19C5,20.1 5.9,21 7,21H17C18.1,21 19,20.1 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z"></path></svg>`;
  deleteButton.addEventListener('click', (e) => {
    e.stopPropagation();
    createConfirmModal({
      message: `Are you sure you want to delete this card: "${card.text}"?`,
      confirmText: 'Delete Card',
      onConfirm: () => {
        const col = columns.find(c => c.id === columnId);
        if (col) {
          col.cards = col.cards.filter(c => c.id !== card.id);
          renderApp();
        }
      }
    });
  });

  cardActions.append(editButton, deleteButton);
  
  const cardMeta = document.createElement('div');
  cardMeta.className = 'card-meta';

  if (card.dueDate) {
    const icon = document.createElement('span');
    icon.className = 'detail-icon';
    // Use an SVG for a consistent, clean look, matching the modal icon
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89,3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z"/></svg>`;

    const dueDateEl = document.createElement('span');
    dueDateEl.className = 'card-due-date';

    const date = new Date(card.dueDate + 'T00:00:00');
    // Set text content directly, no need for the "Due" prefix
    dueDateEl.textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    
    const today = new Date();
    today.setHours(0,0,0,0);
    if (date < today) {
        dueDateEl.classList.add('overdue');
    } else {
        dueDateEl.classList.add('active-due');
    }
    cardMeta.append(icon, dueDateEl);
  }

  contentWrapper.append(cardMeta);
  cardEl.append(contentWrapper, cardActions);

  cardEl.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    handleDragStart(e, { type: 'card', fromColIndex: columnIndex, fromCardIndex: cardIndex });
  });
  cardEl.addEventListener('dragend', handleDragEnd);
  cardEl.addEventListener('dragover', (e) => e.preventDefault());
  cardEl.addEventListener('drop', (e) => {
      e.stopPropagation();
      handleCardDrop(columnIndex, cardIndex);
  });

  return cardEl;
};

const createColumnElement = (column, columnIndex) => {
  const columnEl = document.createElement('div');
  columnEl.className = 'column';
  columnEl.setAttribute('role', 'list');
  columnEl.style.backgroundColor = column.color.bg;
  columnEl.style.borderLeft = `4px solid ${column.color.main}`;

  const header = document.createElement('div');
  header.className = 'column-header';
  
  const titleWrapper = document.createElement('div');
  titleWrapper.className = 'column-title-wrapper';
  
  const title = document.createElement('h2');
  title.textContent = column.title;

  const addCardHeaderButton = document.createElement('button');
  addCardHeaderButton.className = 'edit-btn add-card-header-btn';
  addCardHeaderButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"></path></svg>`;
  addCardHeaderButton.setAttribute('aria-label', `Add a card to ${column.title}`);

  const editButton = document.createElement('button');
  editButton.className = 'edit-btn';
  editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"></path></svg>`;
  editButton.setAttribute('aria-label', `Edit list title for ${column.title}`);

  titleWrapper.append(editButton, title, addCardHeaderButton);

  const cardCount = document.createElement('div');
  cardCount.className = 'card-count';
  cardCount.textContent = column.cards.length;
  
  const enableTitleEdit = () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'column-title-input';
    input.value = title.textContent;
    input.maxLength = 50;

    let hasRestored = false; // Flag to prevent double execution from blur and keydown

    const restoreTitle = (shouldSave) => {
      if (hasRestored) return;
      hasRestored = true;

      if (shouldSave) {
        const newTitle = input.value.trim();
        if (newTitle) {
          columns[columnIndex].title = newTitle;
          title.textContent = newTitle;
          editButton.setAttribute('aria-label', `Edit list title for ${newTitle}`);
        }
      }
      input.replaceWith(titleWrapper);
    };

    input.addEventListener('blur', () => restoreTitle(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        restoreTitle(true);
      } else if (e.key === 'Escape') {
        restoreTitle(false);
      }
    });

    titleWrapper.replaceWith(input);
    input.focus();
    input.select();
  };

  editButton.addEventListener('click', enableTitleEdit);
  header.append(titleWrapper, cardCount);

  const separator = document.createElement('div');
  separator.className = 'column-header-separator';
  separator.style.backgroundColor = column.color.main;

  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'cards-container';

  column.cards.forEach((card, cardIndex) => {
    const cardEl = createCardElement(card, columnIndex, cardIndex, column.id);
    cardsContainer.appendChild(cardEl);
  });

  const addCardHandler = () => {
    addCardHeaderButton.style.display = 'none';
    editButton.style.display = 'none';
    
    const form = createAddItemForm({
      placeholder: 'Enter a title for this card...',
      ctaText: 'Add',
      maxLength: 100,
      onAdd: (text) => {
        const newCard = { id: generateId(), text, description: '', dueDate: '' };
        columns[columnIndex].cards.unshift(newCard);
        renderApp();
      },
      onCancel: () => {
        form.remove();
        addCardHeaderButton.style.display = 'flex';
        editButton.style.display = 'flex';
      }
    });
    separator.after(form);
    form.querySelector('textarea').focus();
  };

  addCardHeaderButton.addEventListener('click', addCardHandler);

  // Column Drag & Drop
  columnEl.draggable = true;
  columnEl.addEventListener('dragstart', (e) => handleDragStart(e, { type: 'column', fromIndex: columnIndex }));
  columnEl.addEventListener('dragend', handleDragEnd);
  columnEl.addEventListener('dragover', (e) => e.preventDefault());
  columnEl.addEventListener('drop', (e) => handleColumnDrop(e, columnIndex));

  // Card Drag & Drop
  cardsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      columnEl.classList.add('drag-over');
  });
  cardsContainer.addEventListener('dragenter', (e) => {
      e.preventDefault();
      columnEl.classList.add('drag-over');
  });
  cardsContainer.addEventListener('dragleave', () => columnEl.classList.remove('drag-over'));
  cardsContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      columnEl.classList.remove('drag-over');
      handleCardDrop(columnIndex, column.cards.length);
  });
  
  columnEl.append(header, separator, cardsContainer);
  return columnEl;
};

const createProfilePopover = (profileElement) => {
    const existingPopover = document.querySelector('.profile-popover');
    if (existingPopover) {
        existingPopover.remove();
        return;
    }

    const popover = document.createElement('div');
    popover.className = 'profile-popover';

    // Avatar Section
    const avatarSection = document.createElement('div');
    avatarSection.className = 'popover-section';
    const avatarTitle = document.createElement('h4');
    avatarTitle.textContent = 'Profile Picture';
    const fileUpload = document.createElement('label');
    fileUpload.className = 'custom-file-upload';
    fileUpload.textContent = 'Upload Photo';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                userData.avatar = event.target.result;
                saveUserData();
                profileElement.querySelector('.user-avatar').style.backgroundImage = `url(${userData.avatar})`;
            };
            reader.readAsDataURL(file);
        }
    };
    fileUpload.appendChild(fileInput);
    avatarSection.append(avatarTitle, fileUpload);

    // Theme Section
    const themeSection = document.createElement('div');
    themeSection.className = 'popover-section';
    const themeTitle = document.createElement('h4');
    themeTitle.textContent = 'Theme';
    const themeSelector = document.createElement('select');
    themeSelector.className = 'theme-selector';
    Object.keys(THEMES).forEach(themeName => {
        const option = document.createElement('option');
        option.value = themeName;
        option.textContent = themeName;
        if (themeName === userData.theme) {
            option.selected = true;
        }
        themeSelector.appendChild(option);
    });
    themeSelector.onchange = (e) => {
        applyTheme(e.target.value);
    };
    themeSection.append(themeTitle, themeSelector);

    popover.append(avatarSection, themeSection);
    document.body.appendChild(popover);

    // Close popover when clicking outside
    const closePopover = (e) => {
        if (!popover.contains(e.target) && !profileElement.contains(e.target)) {
            popover.remove();
            document.removeEventListener('click', closePopover);
        }
    };
    setTimeout(() => document.addEventListener('click', closePopover), 0);
};

const createBoardHeader = () => {
    const header = document.createElement('header');
    header.className = 'board-header';

    // Left: Title Group
    const titleGroup = document.createElement('div');
    titleGroup.className = 'header-title-group';
    const icon = document.createElement('div');
    icon.className = 'header-icon';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19,3H5C3.89,3 3,3.89,3,5V19C3,20.11 3.9,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.11,3 19,3M11,17H7V7H11V17M17,17H13V11H17V17M17,9H13V7H17V9Z" /></svg>`;
    const textDiv = document.createElement('div');
    textDiv.className = 'header-text';
    const title = document.createElement('h1');
    title.textContent = 'Kanban Board';
    const description = document.createElement('p');
    description.textContent = 'Organize and track your work';
    textDiv.append(title, description);
    titleGroup.append(icon, textDiv);

    // Center: Fun Fact
    const funFactContainer = document.createElement('div');
    funFactContainer.className = 'fun-fact-container';
    const funFactTitle = document.createElement('p');
    funFactTitle.className = 'fun-fact-title';
    funFactTitle.innerHTML = 'Fun Fact 🙂';
    const funFactContent = document.createElement('p');
    funFactContent.className = 'fun-fact-content';
    funFactContent.textContent = ''; // Will be populated by fetchAndDisplayFunFact
    funFactContainer.append(funFactTitle, funFactContent);
    
    // Right Panel: Actions + User Profile
    const rightPanel = document.createElement('div');
    rightPanel.className = 'header-right-panel';

    const addButton = document.createElement('button');
    addButton.className = 'add-list-btn';
    addButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"></path></svg> <span>New List</span>`;
    addButton.setAttribute('aria-label', 'Add New List');
    addButton.addEventListener('click', createAddListModal);

    const userProfile = document.createElement('div');
    userProfile.className = 'user-profile';
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    if (userData.avatar) {
        avatar.style.backgroundImage = `url(${userData.avatar})`;
    }
    const nameContainer = document.createElement('div');
    nameContainer.className = 'user-name-container';
    const nameEl = document.createElement('span');
    nameEl.className = 'user-name';
    nameEl.textContent = userData.name;
    const editIcon = document.createElement('span');
    editIcon.className = 'edit-name-icon';
    editIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"></path></svg>`;
    
    const enableNameEditing = () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'user-name-input';
        input.value = nameEl.textContent;
        input.maxLength = 20;

        let hasRestored = false; // Flag to prevent double execution

        const restoreName = (shouldSave) => {
            if (hasRestored) return;
            hasRestored = true;

            if (shouldSave) {
                const newName = input.value.trim();
                if (newName) {
                    userData.name = newName;
                    nameEl.textContent = newName;
                    saveUserData();
                }
            }
            input.replaceWith(nameContainer);
        };
        
        input.addEventListener('blur', () => restoreName(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') restoreName(true);
            else if (e.key === 'Escape') restoreName(false);
        });

        nameContainer.replaceWith(input);
        input.focus();
        input.select();
    };

    nameContainer.addEventListener('click', enableNameEditing);
    avatar.addEventListener('click', () => createProfilePopover(userProfile));

    nameContainer.append(nameEl, editIcon);
    userProfile.append(avatar, nameContainer);
    
    rightPanel.append(addButton, userProfile);

    header.append(titleGroup, funFactContainer, rightPanel);
    return header;
};


// --- RENDER & INITIALIZATION ---
const renderApp = (error = null) => {
    appContainer.innerHTML = '';

    if (error) {
        const errorEl = document.createElement('div');
        errorEl.className = 'loading-container';
        errorEl.textContent = error;
        appContainer.appendChild(errorEl);
        return;
    }
    
    const header = createBoardHeader();
    const board = renderBoard();
    
    appContainer.append(header, board);
};

const renderBoard = () => {
    const boardEl = document.createElement('main');
    boardEl.className = 'board';
    boardEl.setAttribute('aria-label', 'Kanban Board');
    
    columns.forEach((column, index) => {
        const columnEl = createColumnElement(column, index);
        boardEl.appendChild(columnEl);
    });

    return boardEl;
};

const initializeApp = async () => {
  loadUserData();
  if (userData.theme && THEMES[userData.theme]) {
      COLOR_PALETTE = THEMES[userData.theme];
  }

  try {
    if (!API_KEY) {
      throw new Error("API_KEY not found.");
    }
    const ai = new GoogleGenAI({apiKey: API_KEY});

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Create a JSON structure for a Kanban board for a "New Web App Project". Include "To Do", "In Progress", "Code Review", and "Done" columns. For each column, include 2-3 sample task cards, each with a "text" (the title), a short "description", and a "dueDate" in "YYYY-MM-DD" format. Make one of the due dates in the past.',
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              cards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    description: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
    });

    const boardData = JSON.parse(response.text);
    columns = boardData.map((col, index) => ({
      ...col,
      id: generateId(),
      cards: col.cards.map(card => ({ ...card, id: generateId() })),
      color: COLOR_PALETTE[index % COLOR_PALETTE.length],
    }));
    renderApp();
    fetchAndDisplayFunFact(userData.theme);
  } catch (err) {
    console.error("Failed to generate board:", err);
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const pastDateString = pastDate.toISOString().split('T')[0];

    columns = [
      { id: 'c1', title: 'To Do', cards: [
          {id: 't1', text: 'Setup project', description: 'Initialize repository and install dependencies.', dueDate: ''}, 
          {id: 't2', text: 'Create components', description: 'Build reusable UI components for the design system.', dueDate: new Date().toISOString().split('T')[0]}
      ] },
      { id: 'c2', title: 'In Progress', cards: [
          {id: 't3', text: 'Design landing page', description: 'Create mockups and wireframes in Figma for the main landing page.', dueDate: ''}
      ] },
      { id: 'c3', title: 'Done', cards: [
          {id: 't4', text: 'Define project scope', description: 'Initial planning meeting and document creation with stakeholders.', dueDate: pastDateString}
      ] },
    ].map((col, index) => ({
        ...col,
        color: COLOR_PALETTE[index % COLOR_PALETTE.length]
    }));
    renderApp("Could not generate board from AI. Using sample data.");
    fetchAndDisplayFunFact(userData.theme);
  }
};

initializeApp();
