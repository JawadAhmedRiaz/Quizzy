import { db, semestersTable, subjectsTable, questionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

type Q = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  topic: string;
};

const msWordQuestions: Q[] = [
  { question: "Which option creates content automatically?", optionA: "Table of content", optionB: "Insert endnote", optionC: "Mark entry", optionD: "Bookmark", correctAnswer: "A", topic: "MS Word Features" },
  { question: "Table of content is mainly used for?", optionA: "Inserting images in document", optionB: "Organizing headings in document", optionC: "Adding page borders", optionD: "Creating footnotes", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option updates an existing table of contents?", optionA: "Refresh table", optionB: "Rebuild index", optionC: "Update table", optionD: "Insert new table", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Endnote appears at?", optionA: "Top of page", optionB: "Side margin", optionC: "Middle of page", optionD: "Bottom of document", correctAnswer: "D", topic: "MS Word Features" },
  { question: "Which option displays all footnotes in a document?", optionA: "View all", optionB: "Display notes", optionC: "Show notes", optionD: "List footnotes", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which group contains Insert Footnote and Insert Endnote?", optionA: "References", optionB: "Footnotes", optionC: "Citations", optionD: "Captions", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Citations are used in?", optionA: "Personal diaries", optionB: "Academic writing", optionC: "Chat messages", optionD: "Graphic design", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option is used to add a reference of a book and citation?", optionA: "Add bookmark", optionB: "Insert endnote", optionC: "Insert citation", optionD: "Manage sources", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option manages Sources?", optionA: "Source list", optionB: "Add reference", optionC: "Edit citation", optionD: "Manage Sources", correctAnswer: "D", topic: "MS Word Features" },
  { question: "Bibliography contains?", optionA: "List of figures", optionB: "Index entries", optionC: "Table of contents", optionD: "List of references and sources", correctAnswer: "D", topic: "MS Word Features" },
  { question: "Which option adds a title below pictures?", optionA: "Alt text", optionB: "Label", optionC: "Caption", optionD: "Title", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Table of figures is created from?", optionA: "Bookmarks", optionB: "Headers", optionC: "Captions", optionD: "Index entries", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option updates the table of figures?", optionA: "Refresh figures", optionB: "Update table", optionC: "Rebuild", optionD: "Regenerate", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Cross reference is used for?", optionA: "Adding images", optionB: "Creating footnotes", optionC: "Link to another part of document", optionD: "Setting margins", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which group contains Caption and Cross Reference?", optionA: "Insert tab", optionB: "References", optionC: "Captions", optionD: "Links", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Index is used to?", optionA: "Create headings", optionB: "Add footnotes", optionC: "List important topics with page numbers", optionD: "Format text", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option marks a word for an index?", optionA: "Index word", optionB: "Add marker", optionC: "Mark entry", optionD: "Label entry", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option creates the final index?", optionA: "Build index", optionB: "Create index", optionC: "Mark index", optionD: "Insert index", correctAnswer: "D", topic: "MS Word Features" },
  { question: "Table of Authorities is used for?", optionA: "Academic papers", optionB: "Legal documents", optionC: "Business reports", optionD: "Scientific journals", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option is used for legal citation?", optionA: "Insert citation", optionB: "Mark citation", optionC: "Legal mark", optionD: "Add citation", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which group contains Mark Citation and Table of Authorities?", optionA: "Captions", optionB: "Footnotes", optionC: "Citations & Bibliography", optionD: "Table of Authorities", correctAnswer: "D", topic: "MS Word Features" },
  { question: "Which option helps avoid plagiarism?", optionA: "Bookmark", optionB: "Citation", optionC: "Footnote", optionD: "Endnote", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option is used to set margins?", optionA: "Orientation", optionB: "Margins", optionC: "Colors", optionD: "Breaks", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which orientation places a page vertically?", optionA: "Landscape", optionB: "Portrait", optionC: "Horizontal", optionD: "Widescreen", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option changes the page size?", optionA: "Margins", optionB: "Orientation", optionC: "Size", optionD: "Columns", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option divides text into vertical sections?", optionA: "Breaks", optionB: "Columns", optionC: "Hyphenation", optionD: "Orientation", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option starts text on a new page?", optionA: "Section break", optionB: "Column break", optionC: "Page break", optionD: "Line break", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option automatically splits long words?", optionA: "Column break", optionB: "Autocorrect", optionC: "Word wrap", optionD: "Hyphenation", correctAnswer: "D", topic: "MS Word Features" },
  { question: "Which group contains Margins, Orientation and Size?", optionA: "Arrange", optionB: "Paragraph", optionC: "Page Setup", optionD: "Font", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option controls paragraph distance from the margin?", optionA: "Spacing", optionB: "Indent", optionC: "Columns", optionD: "Breaks", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Paragraph spacing controls?", optionA: "Font size", optionB: "Space before and after paragraph", optionC: "Page margins", optionD: "Line breaks", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which group contains Watermark, Page Color and Page Border?", optionA: "Page Layout", optionB: "Design", optionC: "Page Background", optionD: "Themes", correctAnswer: "C", topic: "MS Word Features" },
  { question: "A watermark is?", optionA: "A border design", optionB: "A background text or image", optionC: "A header element", optionD: "A footnote style", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option adds a decorative line around a page?", optionA: "Page Color", optionB: "Watermark", optionC: "Page Border", optionD: "Theme border", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option changes the page background color?", optionA: "Watermark", optionB: "Theme", optionC: "Page Color", optionD: "Highlight color", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Fonts are used to?", optionA: "Insert images", optionB: "Change writing style", optionC: "Add borders", optionD: "Set margins", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Themes help a document look?", optionA: "Colorful", optionB: "Simple", optionC: "Professional", optionD: "Animated", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Design is an example of?", optionA: "Group", optionB: "Button", optionC: "Tab", optionD: "Menu", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option helps connect sections inside a document?", optionA: "Bookmark", optionB: "Hyperlink", optionC: "Cross reference", optionD: "Footer link", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which feature is used to create a flowchart?", optionA: "Footer", optionB: "Equation", optionC: "Shapes", optionD: "SmartArt diagram", correctAnswer: "C", topic: "MS Word Features" },
  { question: "The Design tab is used for?", optionA: "Calculations", optionB: "Drawing graphs", optionC: "Document formatting", optionD: "Internet browsing", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which Design option changes the overall look of a document?", optionA: "Font", optionB: "Color", optionC: "Theme", optionD: "Style set", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Themes include?", optionA: "Colors and Fonts", optionB: "Effects only", optionC: "Borders only", optionD: "Images only", correctAnswer: "A", topic: "MS Word Features" },
  { question: "Which option changes the document font combination?", optionA: "Colors", optionB: "Fonts", optionC: "Watermark", optionD: "Effects", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option changes the color scheme of a document?", optionA: "Fonts", optionB: "Theme", optionC: "Colors", optionD: "Watermark", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which feature allows searching images from the internet?", optionA: "Shapes", optionB: "Online Pictures", optionC: "WordArt", optionD: "SmartArt", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option inserts predesigned diagrams?", optionA: "Shapes", optionB: "Charts", optionC: "SmartArt", optionD: "Symbol", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which tool is used to insert a graph?", optionA: "Screenshot", optionB: "Chart", optionC: "Shape", optionD: "Table", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option captures open windows for insertion?", optionA: "Screenshot", optionB: "Pictures", optionC: "Clip art", optionD: "Online Pictures", correctAnswer: "A", topic: "MS Word Features" },
  { question: "Which feature inserts web links?", optionA: "Bookmark", optionB: "Hyperlinks", optionC: "Symbol", optionD: "Cross reference", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option marks a specific place in a document?", optionA: "Cross reference", optionB: "Bookmark", optionC: "Header", optionD: "Hyperlink", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which feature refers readers to another part of a document?", optionA: "Screenshot", optionB: "Cross reference", optionC: "Bookmark", optionD: "Equation", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option adds review notes in a document?", optionA: "Header", optionB: "Footer", optionC: "Comments", optionD: "Object", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which tab contains Header and Footer?", optionA: "Home tab", optionB: "References", optionC: "Insert tab", optionD: "Design tab", correctAnswer: "C", topic: "MS Word Features" },
  { question: "What is the purpose of Header?", optionA: "Add text at top of page", optionB: "Add page numbers only", optionC: "Format document text", optionD: "Create an index", correctAnswer: "A", topic: "MS Word Features" },
  { question: "What is the purpose of Footer?", optionA: "Add text at top of page", optionB: "Add text at bottom of page", optionC: "Create bookmarks", optionD: "Insert images", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which feature automatically numbers pages?", optionA: "Page Number", optionB: "Date and Time", optionC: "Bookmark", optionD: "Footer", correctAnswer: "A", topic: "MS Word Features" },
  { question: "Which option inserts date and time?", optionA: "Timestamp", optionB: "Date and Time", optionC: "Clock", optionD: "Calendar", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option creates a movable text area?", optionA: "WordArt", optionB: "Object", optionC: "Text Box", optionD: "Symbol", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option inserts artistic text style?", optionA: "WordArt", optionB: "Drop Cap", optionC: "Shapes", optionD: "Object", correctAnswer: "A", topic: "MS Word Features" },
  { question: "Which option enlarges the first letter of a paragraph?", optionA: "Drop Cap", optionB: "WordArt", optionC: "Symbol", optionD: "SmartArt", correctAnswer: "A", topic: "MS Word Features" },
  { question: "Which option inserts external files or objects?", optionA: "Screenshot", optionB: "Object", optionC: "Table", optionD: "Chart", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option inserts mathematical formulas?", optionA: "Symbol", optionB: "Equation", optionC: "Bookmark", optionD: "Chart", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option inserts special characters?", optionA: "Shapes", optionB: "Symbol", optionC: "Equation", optionD: "SmartArt", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which group contains Pictures, Shapes and Charts?", optionA: "Links", optionB: "Text", optionC: "Illustrations", optionD: "Symbols", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which feature is used for a decorative page introduction?", optionA: "Cover Page", optionB: "Footer", optionC: "Hyperlinks", optionD: "Symbol", correctAnswer: "A", topic: "MS Word Features" },
  { question: "Which tab contains the Equation option?", optionA: "Home", optionB: "Insert", optionC: "Design", optionD: "References", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option is used to rotate an object?", optionA: "Flip", optionB: "Rotate", optionC: "Transform", optionD: "Arrange", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which option sends an object behind another object?", optionA: "Bring to Front", optionB: "Send Backward", optionC: "Arrange", optionD: "Group", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Selection Pane is used to?", optionA: "Manage many objects", optionB: "Select fonts", optionC: "Set margins", optionD: "Create groups", correctAnswer: "A", topic: "MS Word Features" },
  { question: "Which option aligns objects properly?", optionA: "Distribute", optionB: "Group", optionC: "Align", optionD: "Arrange", correctAnswer: "C", topic: "MS Word Features" },
  { question: "Which option combines multiple objects into one?", optionA: "Merge", optionB: "Group", optionC: "Combine", optionD: "Align", correctAnswer: "B", topic: "MS Word Features" },
  { question: "Which feature numbers each line in a document?", optionA: "Page Numbers", optionB: "Line Numbers", optionC: "Paragraph marks", optionD: "Bookmarks", correctAnswer: "B", topic: "MS Word Features" },
];

const dataCommQuestions: Q[] = [
  { question: "What is the definition of data communication?", optionA: "Storing data on a local hard drive", optionB: "Transferring data from one device to another", optionC: "Converting analog signals to digital signals", optionD: "Encrypting data for security purposes", correctAnswer: "B", topic: "Data Communication" },
  { question: "Which of the following is NOT listed as a goal of data communication?", optionA: "Send data accurately", optionB: "Send data quickly", optionC: "Send data securely", optionD: "Send data wirelessly", correctAnswer: "D", topic: "Data Communication" },
  { question: "In the components of data communication, what does 'protocol' refer to?", optionA: "The physical cable used for transmission", optionB: "The device that receives the message", optionC: "Rules that help sender and receiver", optionD: "The actual data being sent", correctAnswer: "C", topic: "Data Communication" },
  { question: "Which transmission mode allows data to flow in only one direction?", optionA: "Simplex", optionB: "Half-duplex", optionC: "Full-duplex", optionD: "Duplex", correctAnswer: "A", topic: "Data Communication" },
  { question: "Walkie-talkie communication is an example of which mode?", optionA: "Simplex", optionB: "Half-duplex", optionC: "Full-duplex", optionD: "Parallel transmission", correctAnswer: "B", topic: "Data Communication" },
  { question: "Which wired medium uses light signals instead of electricity to send data?", optionA: "Twisted pair cable", optionB: "Coaxial cable", optionC: "Fiber optic cable", optionD: "Shielded twisted pair", correctAnswer: "C", topic: "Data Communication" },
  { question: "What is a disadvantage of twisted pair cable?", optionA: "It is expensive", optionB: "It is difficult to install", optionC: "Affected by electrical noise", optionD: "It cannot be used indoors", correctAnswer: "C", topic: "Data Communication" },
  { question: "Which type of wireless media requires a clear line of sight and cannot pass through walls?", optionA: "Radio waves", optionB: "Microwaves", optionC: "Infrared waves", optionD: "Bluetooth", correctAnswer: "C", topic: "Data Communication" },
  { question: "Microwaves as a wireless medium have which disadvantage?", optionA: "Very short range", optionB: "Cannot send large amounts of data", optionC: "Affected by weather", optionD: "Causes signal leak to far distances", correctAnswer: "C", topic: "Data Communication" },
  { question: "In parallel transmission, how are bits transferred?", optionA: "One bit at a time over a single wire", optionB: "All bits in one clock cycle", optionC: "Asynchronously with start and stop bits", optionD: "Using a clock signal to sync a block of data", correctAnswer: "B", topic: "Data Communication" },
  { question: "Which type of serial transmission sends one byte at a time with start and stop bits?", optionA: "Synchronous", optionB: "Isochronous", optionC: "Asynchronous", optionD: "Parallel", correctAnswer: "C", topic: "Data Communication" },
  { question: "What is an advantage of synchronous transmission over asynchronous transmission?", optionA: "It is simpler and cheaper", optionB: "It is faster and more efficient", optionC: "It works well for keyboard typing", optionD: "It requires fewer wires", correctAnswer: "B", topic: "Data Communication" },
  { question: "Which device uses an analog signal to carry digital data?", optionA: "Router", optionB: "Modem", optionC: "Switch", optionD: "Repeater", correctAnswer: "B", topic: "Data Communication" },
  { question: "Which of the following is a characteristic of digital transmission?", optionA: "Continuous signal", optionB: "Infinite possible values", optionC: "Discrete signal", optionD: "Direct representation", correctAnswer: "C", topic: "Data Communication" },
  { question: "Compact Disc audio is an example of which concept?", optionA: "Analog signal carrying analog data", optionB: "Digital signal carrying analog data", optionC: "Digital signal carrying digital data", optionD: "Analog signal carrying digital data", correctAnswer: "C", topic: "Data Communication" },
];

const networkTopologyQuestions: Q[] = [
  { question: "What is network topology?", optionA: "Type of network cable", optionB: "Arrangement of network components", optionC: "Internet protocol", optionD: "Network software", correctAnswer: "B", topic: "Network Topology" },
  { question: "Network topology defines the:", optionA: "Speed of network", optionB: "Layout and structure", optionC: "Cost of network", optionD: "Operating system", correctAnswer: "B", topic: "Network Topology" },
  { question: "Topology can be classified into:", optionA: "LAN and WAN", optionB: "Wired and Wireless", optionC: "Physical and Logical", optionD: "Client and Server", correctAnswer: "C", topic: "Network Topology" },
  { question: "Physical topology refers to the:", optionA: "Flow of information", optionB: "Physical layout of nodes and cables", optionC: "Network security", optionD: "Data transmission speed", correctAnswer: "B", topic: "Network Topology" },
  { question: "Logical topology refers to:", optionA: "Physical arrangement of cables", optionB: "Hardware configuration", optionC: "Way information flows in a network", optionD: "Network size", correctAnswer: "C", topic: "Network Topology" },
  { question: "Which is NOT a physical network topology?", optionA: "Bus", optionB: "Star", optionC: "Ring", optionD: "TCP/IP", correctAnswer: "D", topic: "Network Topology" },
  { question: "In a bus topology, computers are connected through a:", optionA: "Hub", optionB: "Switch", optionC: "Wire", optionD: "Router", correctAnswer: "C", topic: "Network Topology" },
  { question: "The central wire used in bus topology is called:", optionA: "Ring", optionB: "Bus", optionC: "Node", optionD: "Link", correctAnswer: "B", topic: "Network Topology" },
  { question: "The ends of the bus are closed with:", optionA: "Repeaters", optionB: "Hubs", optionC: "Terminators", optionD: "Connectors", correctAnswer: "C", topic: "Network Topology" },
  { question: "What is the purpose of terminators in bus topology?", optionA: "Increase speed", optionB: "Absorb signals", optionC: "Connect devices", optionD: "Store data", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which is an advantage of bus topology?", optionA: "Expensive", optionB: "Easy to install", optionC: "Difficult troubleshooting", optionD: "Weak signals", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which is a disadvantage of bus topology?", optionA: "Inexpensive", optionB: "Easily extended", optionC: "Performance decreases with more devices", optionD: "Easy installation", correctAnswer: "C", topic: "Network Topology" },
  { question: "In ring topology, each computer is connected to:", optionA: "Hub only", optionB: "Every other computer", optionC: "Next computer", optionD: "Router only", correctAnswer: "C", topic: "Network Topology" },
  { question: "Messages in a ring topology usually flow in:", optionA: "Both directions", optionB: "One direction", optionC: "Random direction", optionD: "No direction", correctAnswer: "B", topic: "Network Topology" },
  { question: "What is passed around the ring in token passing?", optionA: "Packet", optionB: "Frame", optionC: "Token", optionD: "Signal", correctAnswer: "C", topic: "Network Topology" },
  { question: "A token is a:", optionA: "Cable", optionB: "Short message", optionC: "Router", optionD: "Server", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which topology performs well under heavy load?", optionA: "Bus", optionB: "Ring", optionC: "Tree", optionD: "Hybrid", correctAnswer: "B", topic: "Network Topology" },
  { question: "What happens if one computer fails in a ring topology?", optionA: "No effect", optionB: "Entire network is affected", optionC: "Network speed increases", optionD: "Only one cable is affected", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which topology uses a separate cable for each workstation?", optionA: "Ring", optionB: "Bus", optionC: "Star", optionD: "Tree", correctAnswer: "C", topic: "Network Topology" },
  { question: "In star topology, workstations are connected to a central:", optionA: "Token", optionB: "Hub", optionC: "Terminator", optionD: "Backbone", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which topology is easy to expand and modify?", optionA: "Star", optionB: "Ring", optionC: "Bus", optionD: "Mesh", correctAnswer: "A", topic: "Network Topology" },
  { question: "If a cable fails in star topology, then:", optionA: "Entire network fails", optionB: "Only the connected station is affected", optionC: "Hub fails", optionD: "All stations disconnect", correctAnswer: "B", topic: "Network Topology" },
  { question: "If the hub fails in star topology:", optionA: "Only one station fails", optionB: "Entire network fails", optionC: "Network speed increases", optionD: "Nothing happens", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which topology requires more cables?", optionA: "Bus", optionB: "Ring", optionC: "Star", optionD: "None", correctAnswer: "C", topic: "Network Topology" },
  { question: "In mesh topology, each device is connected to:", optionA: "Hub only", optionB: "One neighboring device", optionC: "Every other device", optionD: "Root node", correctAnswer: "C", topic: "Network Topology" },
  { question: "Mesh topology provides:", optionA: "Single communication path", optionB: "Multiple communication paths between devices", optionC: "Wireless communication only", optionD: "Token passing", correctAnswer: "B", topic: "Network Topology" },
  { question: "A major advantage of mesh topology is:", optionA: "Low cost", optionB: "Error tolerance", optionC: "Less cabling", optionD: "Easy installation", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which topology is the most expensive?", optionA: "Bus", optionB: "Ring", optionC: "Mesh", optionD: "Tree", correctAnswer: "C", topic: "Network Topology" },
  { question: "Which topology is difficult to install and maintain?", optionA: "Star", optionB: "Mesh", optionC: "Bus", optionD: "Ring", correctAnswer: "B", topic: "Network Topology" },
  { question: "In tree topology, the topmost node is called:", optionA: "Parent node", optionB: "Root node", optionC: "Child node", optionD: "Branch node", correctAnswer: "B", topic: "Network Topology" },
  { question: "The root node in a tree topology:", optionA: "Has no node above it", optionB: "Is at the bottom", optionC: "Is optional", optionD: "Has multiple parents", correctAnswer: "A", topic: "Network Topology" },
  { question: "Tree topology is a variation of:", optionA: "Ring topology", optionB: "Bus topology", optionC: "Mesh topology", optionD: "Hybrid topology", correctAnswer: "B", topic: "Network Topology" },
  { question: "An advantage of tree topology is:", optionA: "Difficult fault isolation", optionB: "Scalability", optionC: "Low reliability", optionD: "No hierarchy", correctAnswer: "B", topic: "Network Topology" },
  { question: "Tree topology uses:", optionA: "Multipoint connections", optionB: "Point-to-point connections", optionC: "Wireless links only", optionD: "Satellite links", correctAnswer: "B", topic: "Network Topology" },
  { question: "If the backbone fails in a tree topology:", optionA: "One node fails", optionB: "Entire network is crippled", optionC: "Speed increases", optionD: "No effect", correctAnswer: "B", topic: "Network Topology" },
  { question: "A hybrid topology combines:", optionA: "Similar topologies only", optionB: "Different network topologies", optionC: "Wireless devices only", optionD: "LAN and WAN only", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which combination can form a hybrid topology?", optionA: "Star + Ring", optionB: "Star + Star", optionC: "Tree + Tree", optionD: "Bus + Bus", correctAnswer: "A", topic: "Network Topology" },
  { question: "Connecting the same topology to itself creates:", optionA: "Hybrid topology", optionB: "Mesh topology", optionC: "Not a hybrid topology", optionD: "Logical topology", correctAnswer: "C", topic: "Network Topology" },
  { question: "Hybrid networks are generally:", optionA: "Inflexible", optionB: "Flexible and scalable", optionC: "Slow", optionD: "Difficult to expand", correctAnswer: "B", topic: "Network Topology" },
  { question: "Hybrid topology is commonly used in:", optionA: "Small home networks", optionB: "Large organizations", optionC: "Single-computer systems", optionD: "Standalone devices", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which topology is easiest to troubleshoot?", optionA: "Star", optionB: "Ring", optionC: "Bus", optionD: "None", correctAnswer: "A", topic: "Network Topology" },
  { question: "Which topology has no central communication device?", optionA: "Star", optionB: "Bus", optionC: "Tree", optionD: "Hybrid", correctAnswer: "B", topic: "Network Topology" },
  { question: "In mesh topology, messages are sent:", optionA: "Through a hub", optionB: "Through a backbone", optionC: "Directly from sender to receiver", optionD: "Using token passing", correctAnswer: "C", topic: "Network Topology" },
  { question: "Which topology provides orderly access through token passing?", optionA: "Ring", optionB: "Star", optionC: "Bus", optionD: "Mesh", correctAnswer: "A", topic: "Network Topology" },
  { question: "Which topology has the highest fault tolerance?", optionA: "Bus", optionB: "Star", optionC: "Mesh", optionD: "Ring", correctAnswer: "C", topic: "Network Topology" },
  { question: "Which topology is the least expensive?", optionA: "Mesh", optionB: "Bus", optionC: "Star", optionD: "Hybrid", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which topology uses hierarchical levels?", optionA: "Bus", optionB: "Tree", optionC: "Ring", optionD: "Mesh", correctAnswer: "B", topic: "Network Topology" },
  { question: "Which topology relies on a central hub?", optionA: "Star", optionB: "Ring", optionC: "Bus", optionD: "Mesh", correctAnswer: "A", topic: "Network Topology" },
  { question: "Information flow in a network is determined by:", optionA: "Logical topology", optionB: "Cable type", optionC: "Operating system", optionD: "Processor speed", correctAnswer: "A", topic: "Network Topology" },
  { question: "The arrangement of nodes, links, and peripherals is known as:", optionA: "Network topology", optionB: "Data transmission", optionC: "Routing", optionD: "Switching", correctAnswer: "A", topic: "Network Topology" },
];

const osiQuestions: Q[] = [
  { question: "Which layer provides user-facing network services?", optionA: "Application Layer", optionB: "Presentation Layer", optionC: "Transport Layer", optionD: "Network Layer", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "Which layer handles data formatting functions?", optionA: "Network Layer", optionB: "Session Layer", optionC: "Physical Layer", optionD: "Presentation Layer", correctAnswer: "D", topic: "OSI Model & Protocols" },
  { question: "Which layer manages communication sessions?", optionA: "Session Layer", optionB: "Physical Layer", optionC: "Network Layer", optionD: "Transport Layer", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "Which layer provides end-to-end delivery?", optionA: "Presentation Layer", optionB: "Transport Layer", optionC: "Application Layer", optionD: "Physical Layer", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "Which layer performs routing functions?", optionA: "Network Layer", optionB: "Session Layer", optionC: "Physical Layer", optionD: "Transport Layer", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "Which layer uses MAC addressing?", optionA: "Network Layer", optionB: "Physical Layer", optionC: "Data Link Layer", optionD: "Transport Layer", correctAnswer: "C", topic: "OSI Model & Protocols" },
  { question: "Which layer transmits bits over media?", optionA: "Session Layer", optionB: "Physical Layer", optionC: "Network Layer", optionD: "Transport Layer", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "Which protocol provides reliable delivery?", optionA: "User Datagram Protocol", optionB: "Stream Control Protocol", optionC: "Transmission Control Protocol", optionD: "Internet Control Protocol", correctAnswer: "C", topic: "OSI Model & Protocols" },
  { question: "Which protocol prioritizes communication speed?", optionA: "Transmission Control Protocol", optionB: "User Datagram Protocol", optionC: "Internet Control Protocol", optionD: "Address Resolution Protocol", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "Which protocol supports multi-streaming features?", optionA: "Internet Protocol", optionB: "User Datagram Protocol", optionC: "Stream Control Transmission Protocol", optionD: "Address Resolution Protocol", correctAnswer: "C", topic: "OSI Model & Protocols" },
  { question: "What does a port identify?", optionA: "Specific hardware device", optionB: "Specific application service", optionC: "Specific network cable", optionD: "Specific routing table", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "What forms a socket?", optionA: "IP Address plus Port", optionB: "MAC Address plus Port", optionC: "IP Address plus Frame", optionD: "MAC Address plus Frame", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "What is an IP address?", optionA: "Physical device identifier", optionB: "Logical device identifier", optionC: "Transport service identifier", optionD: "Session service identifier", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "What is a MAC address?", optionA: "Logical network address", optionB: "Physical hardware address", optionC: "Virtual software address", optionD: "Dynamic service address", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "What does Internet Protocol provide?", optionA: "Logical addressing and routing", optionB: "Physical addressing and routing", optionC: "Session addressing and routing", optionD: "Transport addressing and routing", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "What does ARP accomplish?", optionA: "Converts MAC to IP", optionB: "Converts IP to MAC", optionC: "Converts Port to IP", optionD: "Converts Frame to IP", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "What does RARP accomplish?", optionA: "Converts MAC to IP", optionB: "Converts IP to MAC", optionC: "Converts Port to MAC", optionD: "Converts Frame to MAC", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "What does ICMP mainly send?", optionA: "Error status messages", optionB: "Session status messages", optionC: "Transport status messages", optionD: "Application status messages", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "What does IGMP manage?", optionA: "Broadcast service routing", optionB: "Multicast group membership", optionC: "Application group routing", optionD: "Transport group routing", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "Logical address generally refers to:", optionA: "Media Access Address", optionB: "Internet Protocol Address", optionC: "Physical hardware address", optionD: "Transport service address", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "IEEE 802 standards define:", optionA: "LAN and MAN networking", optionB: "WAN and ISP networking", optionC: "TCP and UDP networking", optionD: "FTP and DNS networking", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "What does TR stand for?", optionA: "Token Ring Network", optionB: "Transport Ring Network", optionC: "Token Route Network", optionD: "Transfer Route Network", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "What does FDDI use?", optionA: "Copper cable medium", optionB: "Fiber optic medium", optionC: "Wireless radio medium", optionD: "Satellite link medium", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "What does PPP establish?", optionA: "Direct device connection", optionB: "Indirect device connection", optionC: "Wireless device connection", optionD: "Virtual device connection", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "Which address is a physical address?", optionA: "Internet Protocol Address", optionB: "Logical network address", optionC: "Media Access Address", optionD: "Session control address", correctAnswer: "C", topic: "OSI Model & Protocols" },
  { question: "Which layer contains HTTP protocol services?", optionA: "Application Layer", optionB: "Presentation Layer", optionC: "Transport Layer", optionD: "Network Layer", correctAnswer: "A", topic: "OSI Model & Protocols" },
  { question: "Which layer handles encryption functions?", optionA: "Session Layer", optionB: "Network Layer", optionC: "Presentation Layer", optionD: "Physical Layer", correctAnswer: "C", topic: "OSI Model & Protocols" },
  { question: "Which layer handles compression functions?", optionA: "Data Link Layer", optionB: "Presentation Layer", optionC: "Network Layer", optionD: "Transport Layer", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "Which layer includes TCP and UDP?", optionA: "Session Layer", optionB: "Transport Layer", optionC: "Physical Layer", optionD: "Network Layer", correctAnswer: "B", topic: "OSI Model & Protocols" },
  { question: "How many layers exist in the OSI model?", optionA: "Five", optionB: "Six", optionC: "Seven", optionD: "Eight", correctAnswer: "C", topic: "OSI Model & Protocols" },
];

const softwareQuestions: Q[] = [
  { question: "What does software consist of?", optionA: "Set of computer programs", optionB: "Set of network devices", optionC: "Set of hardware parts", optionD: "Set of storage units", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Software enables a computer to:", optionA: "Perform specific tasks", optionB: "Increase physical size", optionC: "Replace hardware parts", optionD: "Create electrical power", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Software is loaded into:", optionA: "Computer storage area", optionB: "Computer monitor unit", optionC: "Computer printer unit", optionD: "Computer scanner unit", correctAnswer: "A", topic: "Software Concepts" },
  { question: "After loading, software is executed by the:", optionA: "Central Processing Unit", optionB: "Visual Display Unit", optionC: "Data Storage Unit", optionD: "Network Control Unit", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Hardware without software can:", optionA: "Perform no useful task", optionB: "Perform every task well", optionC: "Replace software fully", optionD: "Create programs itself", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Software acts as an interface between:", optionA: "User and computer system", optionB: "Printer and scanner unit", optionC: "Mouse and keyboard unit", optionD: "Monitor and speaker unit", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Software is basically a:", optionA: "Set of instructions given to a computer", optionB: "Set of components fixed in hardware", optionC: "Set of cables connected to devices", optionD: "Set of devices attached to a system", correctAnswer: "A", topic: "Software Concepts" },
  { question: "How many main types of software are there?", optionA: "Two major software types", optionB: "Three major software types", optionC: "Four major software types", optionD: "Five major software types", correctAnswer: "B", topic: "Software Concepts" },
  { question: "Which software manages computer hardware?", optionA: "System software", optionB: "Utility software", optionC: "Application software", optionD: "Educational software", correctAnswer: "A", topic: "Software Concepts" },
  { question: "System software provides a:", optionA: "Foundation for running programs", optionB: "Connection for printers", optionC: "Storage for documents", optionD: "Display for pictures", correctAnswer: "A", topic: "Software Concepts" },
  { question: "System software is often created by:", optionA: "Computer manufacturing firms", optionB: "Internet service providers", optionC: "Social networking firms", optionD: "Digital marketing firms", correctAnswer: "A", topic: "Software Concepts" },
  { question: "System software acts as a bridge between:", optionA: "Hardware and user applications", optionB: "Keyboard, mouse and monitor", optionC: "Browser, website and internet", optionD: "Printer, scanner and speaker", correctAnswer: "A", topic: "Software Concepts" },
  { question: "System software is usually written in:", optionA: "Low level languages", optionB: "High level languages", optionC: "Visual design languages", optionD: "Database query languages", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Which is an example of system software?", optionA: "Operating system", optionB: "Word processing software", optionC: "Graphic design software", optionD: "Video editing software", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Operating system is a:", optionA: "Computer controlling software", optionB: "Computer networking device", optionC: "Computer storage device", optionD: "Computer input device", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Operating system enables:", optionA: "Programs to run properly", optionB: "Hardware to disappear", optionC: "Data to be deleted", optionD: "Networks to disconnect", correctAnswer: "A", topic: "Software Concepts" },
  { question: "The operating system organizes:", optionA: "Computer hardware resources", optionB: "Computer classroom seats", optionC: "Computer training courses", optionD: "Computer business plans", correctAnswer: "A", topic: "Software Concepts" },
  { question: "OS acts as an interface between:", optionA: "Applications and hardware", optionB: "Keyboard and printer", optionC: "Scanner and monitor", optionD: "Browser and website", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Which is an operating system example?", optionA: "Windows, Linux, Unix, Mac", optionB: "Chrome, Firefox, Opera, Edge", optionC: "Word, Excel, PowerPoint, Access", optionD: "Canva, Grammarly, Notion, Zoom", correctAnswer: "A", topic: "Software Concepts" },
  { question: "A language translator converts:", optionA: "Code into machine code", optionB: "Images into documents", optionC: "Audio into pictures", optionD: "Videos into graphics", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Computers directly understand:", optionA: "Machine language only", optionB: "Human language only", optionC: "Programming language only", optionD: "Written language only", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Machine language consists mainly of:", optionA: "Binary ones and zeros", optionB: "Decimal ones and tens", optionC: "Hexadecimal letters only", optionD: "Alphabetical words only", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Utility software is designed to:", optionA: "Maintain the computer system", optionB: "Replace the computer system", optionC: "Manufacture computer parts", optionD: "Transport computer data", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Utility software helps to:", optionA: "Analyze, configure and optimize the system", optionB: "Create paint drawings", optionC: "Browse social websites", optionD: "Watch online movies", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Application software is designed to:", optionA: "Perform specific user tasks", optionB: "Manage hardware devices", optionC: "Build network systems", optionD: "Design processor chips", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Application software focuses on:", optionA: "User required activities", optionB: "Hardware repair activities", optionC: "Network routing activities", optionD: "Security monitoring activities", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Writing documents is done using:", optionA: "Application software tools", optionB: "System software tools", optionC: "Utility software tools", optionD: "Translator software tools", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Modern application software may use:", optionA: "Artificial intelligence tools", optionB: "Mechanical engineering tools", optionC: "Electrical wiring tools", optionD: "Industrial machine tools", correctAnswer: "A", topic: "Software Concepts" },
  { question: "General purpose software is designed for:", optionA: "Common user activities", optionB: "Specific industry activities", optionC: "Hardware repair activities", optionD: "Network routing activities", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Special purpose software is designed for:", optionA: "Specific user activities", optionB: "General user activities", optionC: "Common home activities", optionD: "Standard office activities", correctAnswer: "A", topic: "Software Concepts" },
  { question: "General purpose software usually has:", optionA: "Lower development costs", optionB: "Higher development costs", optionC: "Unlimited development costs", optionD: "Variable development costs", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Special purpose software usually has:", optionA: "Higher customization level", optionB: "Lower customization level", optionC: "Equal customization level", optionD: "Random customization level", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Microsoft Word is an example of:", optionA: "General purpose software", optionB: "Special purpose software", optionC: "System software", optionD: "Utility software", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Banking software is an example of:", optionA: "Special purpose software", optionB: "General purpose software", optionC: "Utility software", optionD: "System software", correctAnswer: "A", topic: "Software Concepts" },
  { question: "General purpose software is usually:", optionA: "Highly flexible", optionB: "Highly restricted", optionC: "Highly secured", optionD: "Highly protected", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Special purpose software is usually:", optionA: "Less flexible", optionB: "More flexible", optionC: "Completely flexible", optionD: "Equally flexible", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Which software optimizes computer performance?", optionA: "Utility software", optionB: "Application software", optionC: "System software", optionD: "Educational software", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Which software runs the computer itself?", optionA: "System software", optionB: "Utility software", optionC: "Application software", optionD: "Entertainment software", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Which software helps users complete tasks?", optionA: "Application software", optionB: "System software", optionC: "Utility software", optionD: "Translator software", correctAnswer: "A", topic: "Software Concepts" },
  { question: "Software and hardware together form:", optionA: "A complete computer system", optionB: "A complete network system", optionC: "A complete database system", optionD: "A complete website system", correctAnswer: "A", topic: "Software Concepts" },
];

async function seed() {
  console.log("🌱 Seeding ICT Semester 1 Final exam questions...");

  const [sem] = await db
    .insert(semestersTable)
    .values({ num: 1, label: "Semester 1", isActive: true, sortOrder: 1 })
    .onConflictDoUpdate({ target: semestersTable.num, set: { label: "Semester 1", isActive: true } })
    .returning();
  console.log(`✅ Semester: ${sem.label} (id=${sem.id})`);

  const [subject] = await db
    .insert(subjectsTable)
    .values({
      sem: 1,
      name: "ICT",
      icon: "💻",
      color: "#0ea5e9",
      gradient: "linear-gradient(135deg,#0284c7,#0ea5e9)",
      isActive: true,
      examTypes: JSON.stringify(["Final"]),
    })
    .onConflictDoUpdate({
      target: [subjectsTable.sem, subjectsTable.name],
      set: { examTypes: JSON.stringify(["Final"]), isActive: true, icon: "💻", color: "#0ea5e9", gradient: "linear-gradient(135deg,#0284c7,#0ea5e9)" },
    })
    .returning();
  console.log(`✅ Subject: ${subject.name} (id=${subject.id})`);

  await db
    .delete(questionsTable)
    .where(
      and(
        eq(questionsTable.sem, 1),
        eq(questionsTable.subject, "ICT"),
        eq(questionsTable.examType, "Final"),
      ),
    );
  console.log("🗑️  Cleared existing ICT Final questions");

  const allQuestions = [
    ...msWordQuestions,
    ...dataCommQuestions,
    ...networkTopologyQuestions,
    ...osiQuestions,
    ...softwareQuestions,
  ].map((q) => ({
    ...q,
    sem: 1,
    subject: "ICT",
    examType: "Final",
  }));

  const BATCH = 50;
  for (let i = 0; i < allQuestions.length; i += BATCH) {
    await db.insert(questionsTable).values(allQuestions.slice(i, i + BATCH));
  }

  console.log(`\n🎉 Done! Inserted ${allQuestions.length} questions:`);
  console.log(`   • MS Word Features:      ${msWordQuestions.length}`);
  console.log(`   • Data Communication:    ${dataCommQuestions.length}`);
  console.log(`   • Network Topology:      ${networkTopologyQuestions.length}`);
  console.log(`   • OSI Model & Protocols: ${osiQuestions.length}`);
  console.log(`   • Software Concepts:     ${softwareQuestions.length}`);
  console.log(`\n   Quiz ID: db-${subject.id}-final`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
