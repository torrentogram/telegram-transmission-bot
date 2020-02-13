const { parseFilesList, renderNodes } = require("./fileTree");

describe("fileTree", () => {
    /**
     * @type {Array<import('./fileTree').FileItem>}
     */
    const files = [
        { name: "folder 1/file1.txt", length: 1024 },
        { name: "folder 1/file2.txt", length: 1024 },
        { name: "file3.txt", length: 1024 },
        { name: "file4.txt", length: 1024 },
        { name: "folder 2/file5.txt", length: 1024 },
        { name: "folder 2/file6.txt", length: 1024 }
    ];
    const torrentId = 123;
    describe("parseFilesList", () => {
        it("should convert a list of files to a list of nodes", () => {
            expect(parseFilesList(files, torrentId)).toMatchInlineSnapshot(`
                Array [
                  Object {
                    "primaryText": "folder 1",
                  },
                  Object {
                    "link": "/file123_0",
                    "primaryText": "file1.txt",
                    "secondaryText": "1KB",
                  },
                  Object {
                    "link": "/file123_1",
                    "primaryText": "file2.txt",
                    "secondaryText": "1KB",
                  },
                  Object {
                    "primaryText": ".",
                  },
                  Object {
                    "link": "/file123_2",
                    "primaryText": "file3.txt",
                    "secondaryText": "1KB",
                  },
                  Object {
                    "link": "/file123_3",
                    "primaryText": "file4.txt",
                    "secondaryText": "1KB",
                  },
                  Object {
                    "primaryText": "folder 2",
                  },
                  Object {
                    "link": "/file123_4",
                    "primaryText": "file5.txt",
                    "secondaryText": "1KB",
                  },
                  Object {
                    "link": "/file123_5",
                    "primaryText": "file6.txt",
                    "secondaryText": "1KB",
                  },
                ]
            `);
        });
    });
    describe("renderNodes", () => {
        it("should convert a list of nodes to string", () => {
            expect(renderNodes(parseFilesList(files, torrentId)))
                .toMatchInlineSnapshot(`
"<pre>folder 1</pre>

/file123_0
<pre>file1.txt</pre>
<i>1KB</i>

/file123_1
<pre>file2.txt</pre>
<i>1KB</i>

<pre>.</pre>

/file123_2
<pre>file3.txt</pre>
<i>1KB</i>

/file123_3
<pre>file4.txt</pre>
<i>1KB</i>

<pre>folder 2</pre>

/file123_4
<pre>file5.txt</pre>
<i>1KB</i>

/file123_5
<pre>file6.txt</pre>
<i>1KB</i>"
`);
        });
    });
});
