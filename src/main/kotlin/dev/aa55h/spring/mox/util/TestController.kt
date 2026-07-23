package dev.aa55h.spring.mox.util

import dev.aa55h.spring.mox.annotation.PossibleResponse
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

data class Abc(@NotBlank @NotNull val message: String)
data class Def(val abc: Abc)
data class Ghi(val abc: Abc, val ghi: String)

@RestController
class TestController {
    @PostMapping("/test")
    fun abc(@RequestBody @Valid abc: Abc) {

    }

    @PostMapping("/test2")
    fun def(@RequestBody abc: Def) {

    }

    @PostMapping("/test3")
    fun ghi(@RequestBody abc: Ghi) {

    }

    @GetMapping("/test4")
    @PossibleResponse(HttpStatus.NOT_ACCEPTABLE, type = Second::class)
    @PossibleResponse(HttpStatus.OK, type = First::class)
    fun xyz(@RequestBody abc: Ghi): First {
        return First(
            a = ""
        )
    }
}

data class First(val a: String)
data class Second(val b: String)