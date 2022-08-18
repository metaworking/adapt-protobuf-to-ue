const fs = require("fs-extra")
const path = require("path")

const EOL = "\r\n"

// your protobuf repo path in disk
const protobufRepoDir = path.normalize("C:/Users/m/Documents/Protobuf/protobuf-v3.21.5")

// output path
const resultDir = path.resolve(__dirname, "ProtobufForUE/protobuf")

const sourceCodeDir = path.join(protobufRepoDir, "src/google/protobuf")


// Disbale warning codes when compile by MSVC
// key: file relative path
// value: warning codes that want to disable
const disableWarningMap = {
    [path.normalize("type.pb.h")]: 4946,
    [path.normalize("type.pb.cc")]: 4800,
    [path.normalize("api.pb.cc")]: 4800,
    [path.normalize("descriptor.pb.h")]: 4946,
    [path.normalize("descriptor.pb.cc")]: 4800,
    [path.normalize("wrappers.pb.cc")]: 4800,
    [path.normalize("descriptor_database.cc")]: 4456,
    [path.normalize("descriptor.cc")]: 4456,
    [path.normalize("extension_set.cc")]: 4946,
    [path.normalize("extension_set_inl.h")]: 4800,
    [path.normalize("map_field.h")]: 4661,
    [path.normalize("map_field.cc")]: [4506, 4946],
    [path.normalize("map_field_inl.h")]: 4800,
    [path.normalize("wire_format.cc")]: 4800,
    [path.normalize("parse_context.cc")]: 4800,
    [path.normalize("generated_message_tctable_lite.cc")]: 4800,
    [path.normalize("text_format.cc")]: 4800,
    [path.normalize("generated_message_reflection.cc")]: [4506, 4065],
    [path.normalize("util/internal/default_value_objectwriter.cc")]: 4800,
    [path.normalize("io/io_win32.cc")]: [4800, 4996],
    [path.normalize("stubs/strutil.cc")]: 4996,
    [path.normalize("stubs/common.cc")]: 4996,
    [path.normalize("io/zero_copy_stream_impl.cc")]: 4996,
    [path.normalize("io/zero_copy_stream.cc")]: 4996,
    [path.normalize("generated_message_util.h")]: 4946,
}

function formatDisableWarningMacro(fileName) {
    const disableWarnings = disableWarningMap[fileName]
    if (!disableWarnings) {
        return '';
    }
    if (Array.isArray(disableWarnings)) {
        return disableWarnings.map((disableCode) => `#pragma warning(disable: ${disableCode})`).join(EOL)
    }
    else if (typeof disableWarnings === "string" || typeof disableWarnings === "number") {
        return `#pragma warning(disable: ${disableWarnings})`
    }
    return '';
}

fs.copy(sourceCodeDir, resultDir, {
    filter: (src, dist) => {
        // ignore files and dirs
        if (
            (src.includes("test") && !src.includes("bytestream")) || // ignore test file
            src.endsWith("bytestream_unittest.cc") ||
            src.includes("json_format_proto3.pb") ||
            (src.endsWith(".proto") && !src.endsWith("any.proto")) || // ignore proto file
            src.endsWith("compiler") || // ignore code for compiler
            false
        ) {
            return false
        }

        // copy dir alway
        if (fs.statSync(src).isDirectory()) {
            return true
        }

        let code = fs.readFileSync(src, 'utf8')

        if (src.endsWith("port_def.inc")) {
            // redefine PROTOBUF_EXPORT & PROTOBUF_EXPORT_TEMPLATE_DEFINE to PROTOBUF_API
            code = code.replace(
                /#if\s+?defined\(PROTOBUF_USE_DLLS\)\s+?&&\s+?defined\(_MSC_VER\)\s*?#\s+?if\s+?defined\(LIBPROTOBUF_EXPORTS\)\s*?#\s+?define\s+?PROTOBUF_EXPORT\s+?__declspec\(dllexport\)\s*?#\s+?define\s+?PROTOBUF_EXPORT_TEMPLATE_DECLARE\s*?#\s+?define\s+?PROTOBUF_EXPORT_TEMPLATE_DEFINE\s+?__declspec\(dllexport\)\s*?#\s+?else\s*?#\s+?define\s+?PROTOBUF_EXPORT\s+?__declspec\(dllimport\)\s*?#\s+?define\s+?PROTOBUF_EXPORT_TEMPLATE_DECLARE\s*?#\s+?define\s+?PROTOBUF_EXPORT_TEMPLATE_DEFINE\s+?__declspec\(dllimport\)\s*?#\s+?endif\s+?\/\/\s+?defined\(LIBPROTOBUF_EXPORTS\)\s*?#elif\s+?defined\(PROTOBUF_USE_DLLS\)\s+?&&\s+?defined\(LIBPROTOBUF_EXPORTS\)\s*?#\s+?define\s+?PROTOBUF_EXPORT\s+?__attribute__\(\(visibility\("default"\)\)\)\s*?#\s+?define\s+?PROTOBUF_EXPORT_TEMPLATE_DECLARE\s+?__attribute__\(\(visibility\("default"\)\)\)\s*?#\s+?define\s+?PROTOBUF_EXPORT_TEMPLATE_DEFINE\s*?#else\s*?#\s+?define\s+?PROTOBUF_EXPORT\s*?#\s+?define\s+?PROTOBUF_EXPORT_TEMPLATE_DECLARE\s*?#\s+?define\s+?PROTOBUF_EXPORT_TEMPLATE_DEFINE\s*?#endif/,
                `#define PROTOBUF_EXPORT PROTOBUF_API${EOL}#define PROTOBUF_EXPORT_TEMPLATE_DECLARE${EOL}#define PROTOBUF_EXPORT_TEMPLATE_DEFINE PROTOBUF_API`
            )
        } else if (src.endsWith("arenastring.cc")) {
            // avoid conflicting check function with the same name
            code = code.replace(
                /(\s+)check\(([\s\S]*?)\)/g,
                "$1g_check($2)"
            )
        } else if (src.endsWith("inlined_string_field.h")) {
            code = code.replace(
                /#if\s+GOOGLE_PROTOBUF_INTERNAL_DONATE_STEAL_INLINE\s+[\s\S]*?#else([\s\S]*?)#endif/g,
                "$1"
            )
        }

        const relativePath = path.relative(sourceCodeDir, src).normalize()

        // add disable warning on file top
        disableListStr = formatDisableWarningMacro(relativePath)
        if (disableListStr) {
            if (src.endsWith("pb.cc")) {
                disableListStr += `${EOL}#pragma warning(disable: 4125)`
            }
            code = `#ifdef _MSC_VER${EOL}${disableListStr}${EOL}#endif //_MSC_VER${EOL}` + code
        }
        fs.outputFileSync(dist, code)

        return false
    }
})